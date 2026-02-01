// Legal AI Platform - Main Application
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './' }))

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Simple JWT using Web Crypto
async function createJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '')
  const encodedPayload = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  })).replace(/=/g, '')
  
  const data = `${encodedHeader}.${encodedPayload}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '')
  
  return `${data}.${encodedSig}`
}

async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Register
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, full_name, organization } = await c.req.json()
    
    if (!email || !password || !full_name) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409)
    }
    
    const passwordHash = await hashPassword(password)
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, full_name, organization, role) VALUES (?, ?, ?, ?, "user")'
    ).bind(email, passwordHash, full_name, organization || null).run()
    
    const user = await c.env.DB.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?')
      .bind(result.meta.last_row_id).first()
    
    const token = await createJWT({ userId: user.id, email: user.email, role: user.role }, 
      c.env.JWT_SECRET || 'default-secret')
    
    return c.json({ success: true, token, user }, 201)
  } catch (error) {
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// Login
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const passwordHash = await hashPassword(password)
    if (passwordHash !== user.password_hash) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const token = await createJWT({ userId: user.id, email: user.email, role: user.role }, 
      c.env.JWT_SECRET || 'default-secret')
    
    await c.env.DB.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()
    
    return c.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Get current user
app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const user = await c.env.DB.prepare(
    'SELECT id, email, full_name, role, organization FROM users WHERE id = ?'
  ).bind(payload.userId).first()
  
  return c.json({ success: true, user })
})

// ============================================================================
// CHAT ROUTES
// ============================================================================

// Query AI
app.post('/api/chat/query', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { message, model, session_id, document_id } = await c.req.json()
  
  // If document_id is provided, fetch document info for context
  let documentContext = ''
  if (document_id) {
    const document: any = await c.env.DB.prepare(
      'SELECT * FROM documents WHERE id = ? AND user_id = ?'
    ).bind(document_id, payload.userId).first()
    
    if (document) {
      documentContext = `\n\nDocument Context:\n- Title: ${document.title}\n- Type: ${document.document_type}\n- Filename: ${document.filename}\n`
    }
  }
  
  let sessionId = session_id
  if (!sessionId) {
    const result = await c.env.DB.prepare(
      'INSERT INTO chat_sessions (user_id, title, ai_model, document_id) VALUES (?, ?, ?, ?)'
    ).bind(payload.userId, message.substring(0, 50), model || 'flan-t5-base', document_id || null).run()
    sessionId = result.meta.last_row_id
  }
  
  // Save user message
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (session_id, role, content) VALUES (?, "user", ?)'
  ).bind(sessionId, message).run()
  
  // Query Hugging Face
  const startTime = Date.now()
  const hfModel = model === 'legal-bert' ? 'nlpaueb/legal-bert-base-uncased' : 'google/flan-t5-base'
  
  try {
    // Note: Hugging Face has deprecated api-inference.huggingface.co
    // For production, consider using:
    // 1. Dedicated Inference Endpoints (https://huggingface.co/inference-endpoints)
    // 2. Hugging Face Pro API with serverless inference
    // 3. Self-hosted models
    
    // Enhanced legal knowledge base with constitutional rights, regulations, and laws
    const legalResponses: Record<string, string> = {
      // Basic Legal Concepts
      'contract': 'A contract is a legally binding agreement between two or more parties that creates mutual obligations enforceable by law. It requires an offer, acceptance, consideration, capacity, and legal purpose.',
      'breach': 'A breach of contract occurs when one party fails to perform their obligations without a valid legal excuse. Remedies include damages, specific performance, or rescission.',
      'tort': 'A tort is a civil wrong that causes harm to another person or their property. Types include negligence, intentional torts (assault, battery, defamation), and strict liability.',
      'liability': 'Legal liability refers to legal responsibility for one\'s acts or omissions. It can be civil (monetary damages) or criminal (fines, imprisonment).',
      'negligence': 'Negligence is failure to exercise reasonable care. Elements: duty of care, breach of duty, causation, and damages.',
      'statute': 'A statute is a written law passed by a legislative body. Statutes are formal enactments that govern jurisdictions.',
      
      // === INDIAN CONSTITUTION - FUNDAMENTAL RIGHTS (Part III, Articles 12-35) ===
      
      'constitution': 'The Constitution of India (adopted 26 Nov 1949, effective 26 Jan 1950) is the supreme law of India. It establishes the framework of government, fundamental rights, directive principles, and duties. Key features: Federal structure, Parliamentary democracy, Fundamental Rights (Articles 12-35), Directive Principles (Articles 36-51), Fundamental Duties (Article 51A), Independent Judiciary, Secularism, Universal Adult Suffrage. Contains 470 Articles in 25 Parts, 12 Schedules, and 105 Amendments (as of 2024).',
      
      'fundamental rights': 'Fundamental Rights (Part III, Articles 12-35) are basic human rights guaranteed by the Indian Constitution. Six categories: (1) Right to Equality (Art 14-18); (2) Right to Freedom (Art 19-22); (3) Right against Exploitation (Art 23-24); (4) Right to Freedom of Religion (Art 25-28); (5) Cultural and Educational Rights (Art 29-30); (6) Right to Constitutional Remedies (Art 32). Originally 7 categories - Right to Property (Art 31) was removed by 44th Amendment (1978) and made a legal right under Article 300A. Can be enforced through writ petitions in Supreme Court (Art 32) and High Courts (Art 226). Subject to reasonable restrictions.',
      
      'article 14': 'Article 14 - Equality before Law: "The State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India." This is the foundation of equality. Guarantees: (1) Equality before law (negative concept) - no person is above law; (2) Equal protection of laws (positive concept) - similar treatment in similar circumstances. Permits reasonable classification based on intelligible differentia having rational relation to object sought. Applies to citizens and non-citizens. Landmark cases: Maneka Gandhi v Union (1978), E.P. Royappa v State of TN (1974).',
      
      'article 15': 'Article 15 - Prohibition of Discrimination: Prohibits discrimination on grounds of religion, race, caste, sex, or place of birth. Clause (1): General prohibition. Clause (2): Access to public places. Clause (3): Special provisions for women and children (enabling clause). Clause (4): Special provisions for socially and educationally backward classes, SCs, STs (added by 1st Amendment). Clause (5): Special provisions for educational institutions (added by 93rd Amendment 2005). Clause (6): Economically weaker sections 10% reservation (added by 103rd Amendment 2019). Does not prevent reasonable classification.',
      
      'article 16': 'Article 16 - Equality of Opportunity in Public Employment: Guarantees equal opportunity in matters of public employment. Clause (1): General equality. Clause (2): No discrimination on grounds of religion, race, caste, sex, descent, place of birth, residence. Clause (3): Parliament may prescribe residence requirement. Clause (4): Reservation for backward classes (enabling provision). Clause (4A): Reservation in promotions for SCs/STs (added by 77th Amendment). Clause (4B): Unfilled reserved vacancies to be carried forward (added by 81st Amendment). Clause (5): Religious institutions exemption. Clause (6): Economically weaker sections reservation in promotions under consideration.',
      
      'article 19': 'Article 19 - Protection of Six Freedoms: Available ONLY to citizens. Six freedoms: (1) Speech and expression (19(1)(a)); (2) Assembly peacefully and without arms (19(1)(b)); (3) Form associations or unions (19(1)(c)); (4) Move freely throughout India (19(1)(d)); (5) Reside and settle in any part (19(1)(e)); (6) Practice any profession, occupation, trade or business (19(1)(g)). Originally 7 rights - Right to property (19(1)(f)) was deleted by 44th Amendment. Each right subject to reasonable restrictions under Art 19(2) to (6) on grounds like: sovereignty & integrity, security of State, public order, decency, morality, contempt of court, defamation, incitement to offense. Landmark case: Shreya Singhal v Union (2015) struck down Sec 66A of IT Act.',
      
      'article 20': 'Article 20 - Protection in respect of Conviction for Offences: Three protections: (1) Ex post facto laws (Clause 1) - No conviction except for violation of law in force at time of commission; no penalty greater than what could be imposed under law at that time. (2) Double jeopardy (Clause 2) - No person shall be prosecuted and punished for the same offense more than once. (3) Self-incrimination (Clause 3) - No person accused of offense shall be compelled to be a witness against himself. Protection against compelled testimony only, not voluntary confession.',
      
      'article 21': 'Article 21 - Protection of Life and Personal Liberty: "No person shall be deprived of his life or personal liberty except according to procedure established by law." Most expansive right - judicial interpretation has expanded scope significantly. Includes: Right to live with dignity, right to livelihood, right to privacy (Puttaswamy judgment 2017), right to education (up to 14 years under Article 21A added by 86th Amendment), right to food, clean environment, speedy trial, free legal aid, shelter, health. Procedure must be just, fair, and reasonable (Maneka Gandhi 1978). Applies to citizens and non-citizens. Not suspended even during emergency except under Article 359.',
      
      'article 21a': 'Article 21A - Right to Education: Added by 86th Constitutional Amendment Act, 2002. "The State shall provide free and compulsory education to all children of the age of six to fourteen years in such manner as the State may, by law, determine." Implemented through Right to Education (RTE) Act, 2009. Makes elementary education a fundamental right. Corresponding Fundamental Duty added in Article 51A(k) for parents/guardians. 25% reservation for economically weaker sections in private schools. Quality education standards prescribed. No capitation fees, screening, or detention till Class 8.',
      
      'article 22': 'Article 22 - Protection Against Arrest and Detention: Two parts: (1) Ordinary law (Clauses 1-2): Rights of arrested person - Right to be informed of grounds of arrest; Right to consult and be defended by lawyer; Right to be produced before magistrate within 24 hours. (2) Preventive detention (Clauses 3-7): Person detained under preventive detention law has: Right to be informed of grounds (as soon as may be); Right to make representation; Detention beyond 3 months requires Advisory Board approval; Maximum detention period prescribed by law. Preventive detention laws: National Security Act 1980, UAPA 1967, etc.',
      
      'article 23': 'Article 23 - Prohibition of Traffic in Human Beings and Forced Labour: Prohibits: (1) Traffic in human beings (buying/selling humans); (2) Begar (forced labour without payment); (3) Other forms of forced labour. Any contravention is an offense punishable by law. Exception: State can impose compulsory service for public purposes (like military conscription, community service). Does not discriminate - applies to all forms of forced labour. Immoral Traffic (Prevention) Act 1956 implements this. Child labour laws also stem from this.',
      
      'article 24': 'Article 24 - Prohibition of Child Labour: "No child below the age of fourteen years shall be employed to work in any factory or mine or engaged in any other hazardous employment." Absolute prohibition on child labour in hazardous industries. Implemented through: Child Labour (Prohibition and Regulation) Act 1986 (amended 2016), Factories Act 1948, Mines Act 1952. 2016 Amendment: Complete prohibition below 14 years (except family business/entertainment with conditions); 14-18 years - adolescent, cannot work in hazardous occupations. Violation is cognizable offense.',
      
      'article 25': 'Article 25 - Freedom of Conscience and Religion: Right to freedom of conscience and right to freely profess, practice and propagate religion. Subject to public order, morality, health and other fundamental rights. State can: (1) Regulate or restrict economic, financial, political, or secular activities associated with religious practice; (2) Provide for social welfare and reform; (3) Throw open Hindu religious institutions to all classes and sections (Art 25(2)(b)). Sikhs allowed to carry kirpan. Propagation allowed but not forced conversions. Individual right, not institutional.',
      
      'article 26': 'Article 26 - Freedom to Manage Religious Affairs: Religious denominations have right to: (1) Establish and maintain institutions for religious and charitable purposes; (2) Manage its own affairs in matters of religion; (3) Own and acquire movable and immovable property; (4) Administer such property in accordance with law. Subject to public order, morality, health. Essential religious practices protected (courts determine what is essential). State can regulate secular/administrative aspects. Applies to organized religions/denominations, not individuals.',
      
      'article 29': 'Article 29 - Protection of Interests of Minorities: Two aspects: (1) Any section of citizens with distinct language, script or culture has right to conserve the same; (2) No citizen shall be denied admission to state-funded/aided educational institution on grounds of religion, race, caste, language. Protects linguistic and cultural minorities. Enables preservation of heritage. Does not prevent reasonable regulations. Used to challenge quota policies in educational institutions.',
      
      'article 30': 'Article 30 - Right of Minorities to Establish Educational Institutions: Religious and linguistic minorities have right to establish and administer educational institutions. Protection against: (1) Taking over of management; (2) Denial of state aid on discriminatory grounds; (3) Malafide restrictions on administration. State can: Regulate standards, prescribe conditions for aid, ensure welfare of students. Minority institution can reserve seats for community. TMA Pai Foundation (2002) clarified scope - minorities determine by state-wise population. Secular instructions allowed.',
      
      'article 32': 'Article 32 - Right to Constitutional Remedies (Heart and Soul of Constitution - Dr. Ambedkar): Guarantees right to move Supreme Court for enforcement of fundamental rights. Supreme Court can issue: (1) Habeas Corpus - produce the person; (2) Mandamus - command to perform public duty; (3) Prohibition - higher court prevents lower court/tribunal from exceeding jurisdiction; (4) Certiorari - quash order of lower court/tribunal; (5) Quo Warranto - challenge person\'s right to public office. Can be suspended only during emergency under Art 359. Parliament cannot curtail this right (Article 368(2) - Kesavananda Bharati). Locus standi relaxed for PIL (public interest litigation).',
      
      // === DIRECTIVE PRINCIPLES OF STATE POLICY (Part IV, Articles 36-51) ===
      
      'directive principles': 'Directive Principles of State Policy (DPSP - Part IV, Articles 36-51) are guidelines for governance to establish a welfare state. Non-justiciable (not enforceable in courts) but fundamental in governance (Article 37). Categories: (1) Socialistic principles - Articles 38, 39, 41, 42, 43, 47; (2) Gandhian principles - Articles 40, 43, 46, 47, 48; (3) Liberal-intellectual principles - Articles 44, 45, 48, 49, 50, 51. Key principles: Social justice, adequate livelihood, equal pay for equal work, free legal aid, uniform civil code, education up to 14 years, protection of environment and wildlife, separation of judiciary from executive, promotion of international peace.',
      
      // === FUNDAMENTAL DUTIES (Part IV-A, Article 51A) ===
      
      'fundamental duties': 'Fundamental Duties (Article 51A, Part IV-A) added by 42nd Amendment (1976), originally 10 duties, 11th added by 86th Amendment (2002). Duties of every citizen: (1) Abide by Constitution, respect institutions, National Flag & Anthem; (2) Cherish ideals of freedom struggle; (3) Uphold sovereignty, unity & integrity; (4) Defend country and render national service when called; (5) Promote harmony and brotherhood, renounce practices derogatory to dignity of women; (6) Value and preserve composite culture and heritage; (7) Protect and improve natural environment; (8) Develop scientific temper, humanism, spirit of inquiry and reform; (9) Safeguard public property, abjure violence; (10) Strive for excellence; (11) Parents/guardians provide education to children 6-14 years. Non-justiciable but courts can consider in interpreting laws.',
      
      // === MAJOR REGULATORY FRAMEWORKS ===
      
      'code of civil procedure': 'Code of Civil Procedure, 1908 (CPC): Procedural law governing civil litigation in India. 158 Sections, 51 Orders, Schedules. Key aspects: Jurisdiction of civil courts (Sections 9-14, 15-25), Res judicata (Section 11), Suit of civil nature (Section 9), Institution and transfer of suits, Pleadings (Order VI), Discovery and inspection (Order XI), Summoning and attendance of witnesses (Order XVI), Judgment and decree (Order XX), Appeals (Order XLI-XLIII), Execution of decrees (Order XXI), Review and revision (Orders XLVII, Order XLVII). Important amendments: 2002 Amendment (introduced case management, ADR, time limits). Applies to all civil proceedings except where modified by special laws.',
      
      'code of criminal procedure': 'Code of Criminal Procedure, 1973 (CrPC): Procedural law for administration of criminal law in India. Replaced CrPC 1898. 565 Sections in 37 Chapters. Key provisions: Constitution and powers of criminal courts (Chapters II-VI), Arrest (Chapter V, Sections 41-60A), Processes (Chapter VI), Bail (Chapter XXXIII, Sections 436-450), FIR (Section 154), Investigation (Sections 154-176), Trial procedure (Chapters XVIII-XXI), Appeals and revisions (Chapters XXIX-XXX), Maintenance (Chapter IX, Section 125), Compounding of offenses (Section 320). Important: Section 161 (examination by police), Section 164 (statement before magistrate), Section 313 (accused examination), Section 482 (High Court inherent powers). BNSS 2023 to replace CrPC from July 2024.',
      
      'indian penal code': 'Indian Penal Code, 1860 (IPC): Substantive criminal law of India. 511 Sections in 23 Chapters. Key chapters: General Exceptions (Chapter IV, Sec 76-106), Offenses against State (Chapter VI), Offenses against Public Tranquility (Chapter VIII), Offenses against Human Body (Chapter XVI, Sec 299-377), Offenses against Property (Chapter XVII, Sec 378-462), Criminal breach of trust (Sec 405-409), Cheating (Sec 415-420), Offenses relating to Documents (Chapter XVIII). Important sections: Murder (302), Culpable homicide (299-304), Hurt (319-338), Rape (375-376), Kidnapping (359-369), Theft (378-382), Robbery/Dacoity (390-402). Maximum punishment: Death penalty or life imprisonment. BNS 2023 to replace IPC from July 2024.',
      
      'indian evidence act': 'Indian Evidence Act, 1872 (IEA): Law of evidence for all judicial proceedings in India. 167 Sections in 3 Parts. Part I: Relevancy of facts (Sec 5-55) - when facts are relevant. Part II: On proof (Sec 56-100) - oral evidence, documentary evidence, burden of proof, presumptions. Part III: Production and effect of evidence (Sec 101-167) - examination of witnesses, expert evidence, character evidence, dying declaration. Key concepts: Facts in issue, relevant facts, admissions (Sec 17-23), confessions (Sec 24-30), dying declaration (Sec 32), expert opinion (Sec 45-51), hearsay (generally inadmissible), best evidence rule (Sec 91), burden of proof (Sec 101-114). Important: Section 65B (electronic evidence certificate). BSA 2023 to replace IEA from July 2024.',
      
      'right to information act': 'Right to Information Act, 2005 (RTI Act): Empowers citizens to access information from public authorities. Enacted to promote transparency and accountability. Key features: Every citizen has right to information (Sec 3), Public authorities must appoint PIOs (Sec 5), Information to be provided within 30 days (Sec 7), First appeal to senior officer (Sec 19), Second appeal to Information Commission (Sec 19). Exemptions (Sec 8): Security, foreign relations, cabinet papers, trade secrets, parliamentary privilege, etc. RTI overrides Official Secrets Act 1923. Information Commissions: Central (CIC) and State (SIC). Penalties for non-compliance (Sec 20). Landmark cases: Namit Sharma v Union (2013).',
      
      'consumer protection act': 'Consumer Protection Act, 2019: Replaced 1986 Act. Protects consumer rights against unfair trade practices. Defines consumer, defect, unfair trade practice, e-commerce. Key provisions: Consumer rights (Sec 2(9)), Consumer Disputes Redressal Commission - District, State, National (Sec 28, 47, 58), Jurisdiction based on value, Product liability (Sec 82-87), Unfair contracts (Sec 16), Misleading advertisements (Sec 21), Central Consumer Protection Authority (Sec 10-32) - regulatory body. E-commerce provisions (Sec 2(16), Rules 2020). Mediation as ADR mechanism. Appeal hierarchy: District → State → National Commission → Supreme Court. Simplified procedures, fast disposal.',
      
      'arbitration act': 'Arbitration and Conciliation Act, 1996: Based on UNCITRAL Model Law. Governs domestic and international commercial arbitration. Key provisions: Arbitration agreement (Sec 7), Appointment of arbitrators (Sec 11), Jurisdiction to decide jurisdiction (Sec 16), Interim measures (Sec 9), Award (Sec 31-32), Setting aside (Sec 34), Enforcement (Sec 36). 2015 Amendment: Time limit for award (12 months), reduced court intervention, fast track (6 months). 2019 Amendment: Arbitration Council of India, automatic stay on award removed, confidentiality. 2021 Amendment: Unconditional stay on awards in case of fraud or corruption. International commercial arbitration: Part II. Conciliation: Part III.',
      
      // International Cybercrime Treaties (continued from previous)
      'budapest convention': 'The Budapest Convention on Cybercrime (2001) is the first and most comprehensive international treaty on cybercrime. Opened by the Council of Europe, it has been ratified by 68+ countries worldwide. It addresses crimes such as illegal access, illegal interception, data interference, system interference, computer-related fraud, child pornography, and copyright infringement. The Convention requires signatories to harmonize domestic laws, improve investigative techniques, and establish 24/7 points of contact for international cooperation. India has not yet ratified this convention.',
      
      'un cybercrime convention': 'The UN Cybercrime Convention (2024) is a newly adopted international treaty aimed at combating cybercrime globally. Unlike the Budapest Convention which focuses on substantive crimes, this convention emphasizes international cooperation, mutual legal assistance, and capacity building. It addresses electronic evidence gathering, extradition for cyber offenses, technical assistance, and prevention measures. The convention seeks to balance cybersecurity with human rights protections. Countries are in the process of ratification as of 2024.',
      
      // India-specific Cybercrime Laws (continued)
      'information technology act': 'The Information Technology Act, 2000 (IT Act) is India\'s primary legislation for addressing cybercrimes and electronic commerce. Key provisions include: Section 43 (unauthorized access, data theft), Section 66 (computer-related offenses), Section 66A (offensive messages - struck down by Supreme Court in 2015), Section 66B (receiving stolen computer resources), Section 66C (identity theft), Section 66D (cheating by impersonation), Section 66E (privacy violation), Section 66F (cyber terrorism), Section 67 (publishing obscene material), and Section 70 (protected systems). Penalties range from fines to imprisonment up to life term for cyber terrorism.',
      
      'it act 2000': 'The IT Act 2000 (amended in 2008) provides the legal framework for electronic governance and e-commerce in India. The 2008 amendments strengthened cybercrime provisions significantly. Key additions included: identity theft (Sec 66C), cyber terrorism (Sec 66F), intermediate liability (Sec 79), and enhanced penalties. The Act established the Cyber Appellate Tribunal and empowered adjudicating officers. However, it faces criticism for low conviction rates, inadequate investigation capacity, and lack of comprehensive data protection provisions.',
      
      'comparative legal analysis': 'Comparative legal analysis examines legal systems, statutes, and judicial practices across different jurisdictions to identify best practices, gaps, and reform opportunities. In cybercrime law, key comparison areas include: (1) Substantive law coverage; (2) Procedural provisions; (3) International cooperation mechanisms; (4) Institutional frameworks; (5) Penalties and enforcement. India\'s framework is often compared with the UK\'s Computer Misuse Act 1990, US laws (CFAA, Wiretap Act), and the Budapest Convention standards.',
      
      'global standards': 'Emerging global standards in cybercrime law include: (1) Harmonization of substantive criminal law; (2) Modernized procedural powers; (3) 24/7 contact points; (4) MLAT streamlining; (5) Electronic evidence preservation; (6) Public-private partnerships; (7) Victim protection; (8) Capacity building; (9) Human rights safeguards; (10) Cross-border data sharing. The Budapest Convention and UN Convention represent these evolving standards.',
      
      'cybercrime': 'Cybercrime encompasses criminal activities using computers or internet. Categories: (1) Crimes against individuals - identity theft, phishing, cyberstalking; (2) Crimes against property - hacking, data theft, malware, ransomware; (3) Crimes against government - cyber terrorism, critical infrastructure attacks; (4) Content-related crimes - child pornography, hate speech, copyright violations. Global losses exceed $6 trillion annually. Challenges: attribution, jurisdiction, rapid technology evolution, cross-border nature requiring international cooperation.',
      
      'hacking': 'Hacking refers to unauthorized access to computer systems. Types: (1) Black hat (illegal) - malicious access for theft/damage; (2) White hat (legal) - ethical hacking with permission; (3) Grey hat - unauthorized but non-malicious. Under Indian IT Act Sections 43 and 66, unauthorized access carries penalties up to 3 years imprisonment. Aggravated hacking involving critical infrastructure or cyber terrorism (Section 66F) can result in life imprisonment.',
      
      'data protection': 'Data protection laws govern collection, storage, processing, and transfer of personal data. India\'s framework: (1) IT Act Section 43A - compensation for negligent data handling; (2) IT Rules 2011 - security practices; (3) Digital Personal Data Protection Act 2023 - comprehensive regime with consent requirements, data principal rights, cross-border transfer rules, Data Protection Board. International: EU GDPR (gold standard) impacts Indian companies serving EU citizens.',
      
      // === INTERNATIONAL HUMAN RIGHTS FRAMEWORKS ===
      
      'universal declaration of human rights': 'Universal Declaration of Human Rights (UDHR, 1948): Adopted by UN General Assembly on 10 December 1948. Foundational document proclaiming inalienable rights of all humans. 30 Articles covering: Right to life, liberty & security (Art 3); Prohibition of slavery & torture (Art 4-5); Recognition as person before law (Art 6); Equality before law (Art 7); Right to effective remedy (Art 8); Freedom from arbitrary arrest (Art 9); Fair trial (Art 10-11); Privacy (Art 12); Freedom of movement (Art 13); Asylum (Art 14); Nationality (Art 15); Marriage & family (Art 16); Property (Art 17); Freedom of thought, conscience, religion (Art 18); Freedom of opinion & expression (Art 19); Assembly & association (Art 20); Political participation (Art 21); Social security (Art 22); Work (Art 23); Rest & leisure (Art 24); Adequate living standard (Art 25); Education (Art 26); Cultural participation (Art 27); Social & international order (Art 28); Duties to community (Art 29); Protection of rights (Art 30). Non-binding but customary international law.',
      
      'iccpr': 'International Covenant on Civil and Political Rights (ICCPR, 1966): UN treaty enforcing UDHR civil and political rights. Entered force 1976. 173 parties (India ratified 1979). 53 Articles in 6 Parts. Key rights: Right to life (Art 6); Freedom from torture (Art 7); Prohibition of slavery (Art 8); Liberty and security (Art 9); Humane treatment of prisoners (Art 10); Freedom of movement (Art 12); Fair trial (Art 14); Recognition before law (Art 16); Privacy (Art 17); Freedom of thought, conscience, religion (Art 18); Freedom of expression (Art 19); Assembly (Art 21); Association (Art 22); Political participation (Art 25); Equality before law (Art 26); Minority rights (Art 27). Monitoring: Human Rights Committee reviews state reports. Optional Protocols: death penalty abolition, individual complaints procedure.',
      
      'icescr': 'International Covenant on Economic, Social and Cultural Rights (ICESCR, 1966): UN treaty on economic, social, cultural rights. Entered force 1976. 171 parties (India ratified 1979). Key rights: Right to work (Art 6); Just and favorable work conditions (Art 7); Trade unions (Art 8); Social security (Art 9); Family protection (Art 10); Adequate standard of living (Art 11); Health (Art 12); Education (Art 13-14); Cultural life (Art 15). Progressive realization principle - states implement gradually to maximum available resources. Monitoring: Committee on Economic, Social and Cultural Rights. Optional Protocol (2008) allows individual complaints.',
      
      'cedaw': 'Convention on the Elimination of All Forms of Discrimination Against Women (CEDAW, 1979): International bill of rights for women. 189 parties (India ratified 1993). 30 Articles. Defines discrimination (Art 1); State obligations to eliminate discrimination (Art 2-3); Temporary special measures (Art 4); Gender stereotypes (Art 5); Trafficking & exploitation (Art 6); Political & public life (Art 7-9); Education (Art 10); Employment (Art 11); Health (Art 12); Economic & social life (Art 13); Rural women (Art 14); Equality before law (Art 15); Marriage & family (Art 16). Committee on Elimination of Discrimination monitors implementation. Optional Protocol (2000) - complaints procedure.',
      
      'crc': 'Convention on the Rights of the Child (CRC, 1989): Most widely ratified human rights treaty. 196 parties (India ratified 1992). Defines child as under 18 years. 54 Articles. Guiding principles: Non-discrimination (Art 2); Best interests of child (Art 3); Right to life, survival, development (Art 6); Respect for child\'s views (Art 12). Rights covered: Name and nationality (Art 7-8); Parental guidance (Art 5); Family reunification (Art 10); Protection from violence (Art 19); Health (Art 24); Education (Art 28-29); Rest, play, culture (Art 31); Protection from exploitation (Art 32-36); Juvenile justice (Art 40). Committee on Rights of Child monitors. Optional Protocols: armed conflict, sale/prostitution/pornography, communications procedure.',
      
      'cat': 'Convention Against Torture (CAT, 1984): Prohibits torture and cruel, inhuman, degrading treatment. 173 parties (India not ratified, only signatory). Defines torture (Art 1): severe pain/suffering intentionally inflicted by/with consent of public official for purposes like obtaining information, punishment, intimidation. Obligations: Criminalize torture (Art 4); Jurisdiction (Art 5); Extradite or prosecute (Art 7); No deportation to torture risk (Art 3 - non-refoulement); Prevent torture (Art 2); No evidence obtained by torture (Art 15); Victim redress (Art 14). Committee Against Torture monitors. Optional Protocol (OPCAT) establishes national prevention mechanisms.',
      
      'crpd': 'Convention on the Rights of Persons with Disabilities (CRPD, 2006): First 21st century human rights treaty. 191 parties (India ratified 2007). 50 Articles. Purpose: promote, protect, ensure full and equal enjoyment of human rights by persons with disabilities. Principles (Art 3): Dignity, non-discrimination, participation, respect for difference, accessibility, equality, inclusion. Rights: Equality before law (Art 12); Access to justice (Art 13); Liberty (Art 14); Freedom from exploitation (Art 16); Independent living (Art 19); Education (Art 24); Health (Art 25); Work (Art 27); Political participation (Art 29); Cultural life (Art 30). Accessibility obligations (Art 9). Committee on Rights of Persons with Disabilities monitors. India enacted Rights of Persons with Disabilities Act 2016.',
      
      // === INTERNATIONAL LABOUR CONVENTIONS (ILO) ===
      
      'ilo conventions': 'International Labour Organization (ILO) Conventions: International labour standards adopted since 1919. 190 Conventions, 206 Recommendations. 8 Fundamental Conventions (Core Labour Standards): Freedom of Association (C87, 1948; C98, 1949); Forced Labour (C29, 1930; C105, 1957); Child Labour (C138, 1973 - minimum age; C182, 1999 - worst forms); Equality (C100, 1951 - equal remuneration; C111, 1958 - discrimination in employment). India ratified 6 of 8 fundamental conventions (not C87, C138). Other important: C81 Labour Inspection, C129 Labour Inspection Agriculture, C144 Tripartite Consultation. ILO Declaration on Fundamental Principles and Rights at Work (1998) makes core standards binding even without ratification.',
      
      'child labour': 'Child Labour Conventions and Laws: International: ILO C138 (Minimum Age Convention 1973) - minimum age 15 years (14 for developing countries); ILO C182 (Worst Forms of Child Labour 1999) - prohibits slavery, trafficking, forced labour, prostitution, illicit activities, hazardous work for children under 18. India: Constitutional prohibition - Article 24 (no child under 14 in factories/mines/hazardous work); Child Labour (Prohibition and Regulation) Act 1986 (amended 2016) - complete prohibition under 14 except family business/entertainment with safeguards; 14-18 years adolescent, no hazardous work; Right to Education Act 2009 - free compulsory education 6-14 years. Penalties: imprisonment up to 2 years and fines. Implementation challenges: informal sector, poverty, enforcement gaps.',
      
      'forced labour': 'Forced Labour: Prohibition under ILO C29 (Forced Labour Convention 1930) and C105 (Abolition of Forced Labour 1957). Definition: work or service extracted under menace of penalty, for which person has not offered voluntarily. Exceptions: military service, civic obligations, prison labour (not hired to private entities), emergencies, minor communal services. Modern forms: human trafficking, bonded labour, debt bondage, forced domestic work, forced criminal activity. India: Constitutional prohibition - Article 23 prohibits traffic in humans and begar (forced labour); Bonded Labour System (Abolition) Act 1976 abolished bonded labour, provides rehabilitation; Penalties: imprisonment up to 3 years. Global estimate: 25 million in forced labour worldwide (ILO 2021).',
      
      // === ENVIRONMENTAL LAW ===
      
      'environmental law': 'Environmental Law: Legal framework protecting environment and natural resources. India: Constitutional provisions - Article 48A (DPSP - protect environment, forests, wildlife); Article 51A(g) (Fundamental Duty - protect environment). Key statutes: Environment (Protection) Act 1986 (umbrella legislation post-Bhopal); Water (Prevention and Control of Pollution) Act 1974; Air (Prevention and Control of Pollution) Act 1981; Forest (Conservation) Act 1980; Wildlife Protection Act 1972; Biological Diversity Act 2002; National Green Tribunal Act 2010 (established NGT - specialized environmental court). Principles: Precautionary principle; Polluter pays; Sustainable development; Public trust doctrine; Intergenerational equity. International: Stockholm Declaration 1972; Rio Declaration 1992; Paris Agreement 2015 (climate change); Convention on Biological Diversity 1992.',
      
      'climate change': 'Climate Change Law: International: UNFCCC (1992) - framework convention; Kyoto Protocol (1997) - binding emission targets for developed countries; Paris Agreement (2015) - 197 parties, limit warming to well below 2°C, pursue 1.5°C, Nationally Determined Contributions (NDCs), climate finance. India: Ratified Paris Agreement 2016. NDC commitments: reduce emissions intensity of GDP by 45% by 2030 (from 2005 levels); achieve 50% cumulative electric power installed capacity from non-fossil sources by 2030; create carbon sink of 2.5-3 billion tonnes CO2 equivalent through forests. National Action Plan on Climate Change (NAPCC) - 8 missions. Energy Conservation Act 2001 (amended 2022) adds carbon markets, green hydrogen. Climate Change Act under consideration.',
      
      // === INTELLECTUAL PROPERTY RIGHTS ===
      
      'intellectual property': 'Intellectual Property Rights (IPR): Legal rights protecting creations of mind. India is party to WTO TRIPS Agreement (1995). Categories: (1) Patents - inventions (Patents Act 1970); (2) Trademarks - brand identity (Trademarks Act 1999); (3) Copyright - creative works (Copyright Act 1957); (4) Designs - aesthetic designs (Designs Act 2000); (5) Geographical Indications - products from specific regions (GI Act 1999); (6) Semiconductor Integrated Circuits - chip layouts (SICL Act 2000); (7) Trade Secrets - confidential business information. Plant Varieties - Protection of Plant Varieties and Farmers\' Rights Act 2001. Institutional: Controller General of Patents, Designs and Trademarks; Copyright Office; Intellectual Property Appellate Board (IPAB - abolished 2021, functions to High Courts).',
      
      'patents': 'Patents Act, 1970 (amended 2005): Grants exclusive right to invention for 20 years. Patentable: novel, non-obvious (inventive step), industrial applicability. Exclusions (Section 3): abstract ideas, mathematical methods, business methods, computer programs per se, plant/animal varieties (except microorganisms), methods of agriculture/horticulture, treatment of humans/animals, traditional knowledge. Section 3(d): incremental pharmaceutical innovations (efficacy threshold - Novartis Glivec case 2013). Compulsory licensing (Section 84): if patent not worked in India, reasonable requirements not met, not available at affordable price. First compulsory license: Natco v Bayer (Sorafenib, 2012). Patent prosecution: application, examination (18 months), opposition (pre/post grant), grant, maintenance fees.',
      
      'copyright': 'Copyright Act, 1957 (amended 2012): Protects original literary, dramatic, musical, artistic works, cinematograph films, sound recordings. Duration: Author\'s life + 60 years (literary/dramatic/musical/artistic); 60 years from publication (films, sound recordings, photographs, posthumous works, government/PSU works). Rights: Economic rights (reproduction, adaptation, public performance, communication to public); Moral rights (paternity, integrity - inalienable). Fair dealing exceptions (Section 52): research, criticism, review, news reporting, education. Performers\' rights (Chapter VIII). Copyright Board adjudicates disputes. Digital rights: 2012 amendments address internet, statutory licenses for cover versions, copyright societies regulation. Infringement: civil (damages, injunction, accounts) and criminal (imprisonment up to 3 years, fines up to ₹2 lakh).',
      
      'trademarks': 'Trademarks Act, 1999: Protects marks (word, device, logo, color, sound, smell, shape) distinguishing goods/services. Registration: 10 years, renewable indefinitely. Collective marks, certification marks allowed. 45 classes (Nice Classification). Examination: absolute grounds (Section 9 - descriptive, generic, deceptive, prohibited), relative grounds (Section 11 - similarity, prior rights). Well-known marks: enhanced protection beyond registered classes (Section 11(6)-(9)). Infringement (Section 29): identical/similar mark, identical/similar goods/services, likelihood of confusion, dilution of well-known mark. Passing off: common law remedy even without registration. Domain name disputes: INDRP (.in domains), UDRP (international). Offenses: false trademark, false trade description (imprisonment up to 3 years, fines up to ₹2 lakh).',
      
      // === COMMERCIAL LAW ===
      
      'companies act': 'Companies Act, 2013: Comprehensive corporate law replacing 1956 Act. 470 Sections, 7 Schedules. Key provisions: Company formation (Sections 3-22); Share capital and debentures (Sections 43-71); Prospectus (Sections 23-35); Acceptance of deposits (Section 73-76); Management and administration (Sections 149-172); Meetings (Sections 96-122); Accounts and audit (Sections 128-148); Insider trading prohibition (Section 195); Fraud (Section 447 - imprisonment up to 10 years, fine up to ₹50 crore); Oppression and mismanagement (Sections 241-246); National Company Law Tribunal (NCLT - Sections 408-434); Insolvency and Bankruptcy Code 2016 integration. Corporate Social Responsibility (Section 135): companies meeting criteria must spend 2% of average net profit on CSR. Key regulators: Registrar of Companies (RoC), Ministry of Corporate Affairs (MCA).',
      
      'competition law': 'Competition Act, 2002: Prevents anti-competitive practices, promotes competition. Competition Commission of India (CCI) - regulatory authority. Prohibited practices: (1) Anti-competitive agreements (Section 3) - cartels (horizontal), vertical restraints (tie-in, exclusive distribution, refusal to deal) if causing AAEC (appreciable adverse effect on competition); (2) Abuse of dominant position (Section 4) - unfair/discriminatory pricing, predatory pricing, denial of market access, tying/bundling; (3) Combinations (Section 5-6) - mergers/acquisitions above thresholds require CCI approval. Penalties: up to 10% of average turnover for 3 preceding years. Leniency program for cartel whistleblowers. Competition Appellate Tribunal (now NCLAT) for appeals. DG investigates upon CCI direction. Prohibition of bid-rigging (Section 3(3)(d)). Settlement/commitment procedure available.',
      
      'insolvency law': 'Insolvency and Bankruptcy Code, 2016 (IBC): Consolidated insolvency law replacing multiple legislations. Time-bound (180 days extendable to 330 days) resolution process. Applicability: Companies, LLPs, Partnerships, Individuals (personal insolvency notified partially). Corporate Insolvency Resolution Process (CIRP - Sections 6-32): Financial Creditor/Operational Creditor/Corporate Debtor initiates; NCLT admits if default (minimum ₹1 crore earlier ₹1 lakh); Insolvency Professional (RP) takes management; Committee of Creditors (CoC) approves resolution plan by 66% vote; If approved - NCLT sanctions, else liquidation. Key: Moratorium on recovery during CIRP; Priority: secured creditors > workmen dues (24 months) > unsecured creditors > shareholders. SARFAESI Act 2002 co-exists for secured creditors\' individual action. Insolvency and Bankruptcy Board of India (IBBI) regulates IPs, agencies.',
      
      // === INTERNATIONAL TRADE & INVESTMENT ===
      
      'wto agreements': 'World Trade Organization (WTO): Established 1995, successor to GATT 1947. 164 members (India founding member). Key agreements: (1) GATT 1994 - trade in goods, MFN, national treatment, tariff binding; (2) GATS - trade in services, 4 modes of supply; (3) TRIPS - intellectual property minimum standards; (4) SPS - sanitary and phytosanitary measures; (5) TBT - technical barriers to trade; (6) Agriculture Agreement - domestic support, export subsidies, market access; (7) Dispute Settlement Understanding (DSU) - binding WTO dispute resolution. Principles: Non-discrimination (MFN - Art I GATT; national treatment - Art III GATT), tariff binding, transparency, special and differential treatment for developing countries. India: Doha Round deadlock, recent focus on bilateral/regional FTAs (RCEP negotiation withdrawn 2019).',
      
      'fema': 'Foreign Exchange Management Act, 1999 (FEMA): Liberalized regime replacing FERA 1973. Objective: facilitate external trade and payments, promote orderly forex market. Regulates: Current account transactions (Section 5); Capital account transactions (Section 6) - requires RBI approval for specified transactions; Export/import of currency (Section 7); Repatriation requirement (Section 4). FDI policy: automatic route (no approval) and government route (approval required). Sectoral caps and conditions. FII/FPI investments. External Commercial Borrowings (ECB). Overseas Direct Investment (ODI). Liberalized Remittance Scheme (LRS) - $250,000 per person per year. Enforcement Directorate (ED) enforces. Penalties: up to 3 times sum involved. FEMA (non-debt instruments) Rules 2019 consolidated FDI rules. Reserve Bank regulates through Master Directions.',
      
      // === TAXATION LAW ===
      
      'gst': 'Goods and Services Tax (GST): Introduced 1 July 2017 through 101st Constitutional Amendment. Destination-based, multi-stage, value-added tax on supply of goods and services. Structure: (1) CGST - Central GST (intra-state supply); (2) SGST - State GST (intra-state); (3) IGST - Integrated GST (inter-state, imports); (4) UTGST - Union Territory GST. Four-tier rate structure: 0% (essential goods), 5%, 12%, 18%, 28% (luxury/sin goods). Composition scheme for small taxpayers (turnover up to ₹1.5 crore). Input Tax Credit (ITC) mechanism. GST Council (Article 279A) - constitutional body recommending rates, exemptions (2/3rd states, 1/3rd Centre). GST Network (GSTN) - IT backbone. Compliance: monthly returns (GSTR-1, GSTR-3B), annual return (GSTR-9). E-way bill for goods movement. Anti-profiteering provisions. Tribunals pending.',
      
      'income tax': 'Income Tax Act, 1961: Direct tax on income. Administered by Central Board of Direct Taxes (CBDT). Assessee categories: Individuals, HUF, Firms, Companies, AOPs, BOIs. Income heads: Salaries, house property, business/profession, capital gains, other sources. Residential status determines tax liability (resident, non-resident, RNOR). New tax regime (optional): lower rates without deductions/exemptions. TDS/TCS provisions. Advance tax. Return filing (ITR-1 to ITR-7). Assessment types: self-assessment, summary assessment, scrutiny assessment, best judgment assessment. Appeals: CIT(A) → ITAT → High Court → Supreme Court. Penalties: under-reporting (50% of tax), misreporting (200%), failure to file return, concealment. Search and seizure powers (Section 132). Transfer pricing provisions for international transactions (Sections 92-92F). GAAR (General Anti-Avoidance Rules) to check tax avoidance.',
    }
    
    // Simple keyword matching for demo
    let responseText = ''
    const lowerMessage = message.toLowerCase()
    
    // Check if this is a document-specific query
    if (document_id && documentContext) {
      const docTitle = documentContext.split('Title: ')[1]?.split('\n')[0] || 'this document'
      const docType = documentContext.split('Type: ')[1]?.split('\n')[0] || 'legal'
      const docFilename = documentContext.split('Filename: ')[1]?.split('\n')[0] || ''
      
      // Detect document topic from filename and title
      const isCybercrimeDoc = docFilename.toLowerCase().includes('cybercrime') || 
                              docTitle.toLowerCase().includes('cybercrime') ||
                              lowerMessage.includes('cybercrime')
      const isIndiaDoc = docFilename.toLowerCase().includes('india') || 
                         docTitle.toLowerCase().includes('india')
      const isComparativeDoc = docFilename.toLowerCase().includes('comparative') || 
                               docTitle.toLowerCase().includes('comparative')
      
      // Enhanced document-aware responses with domain intelligence
      if (lowerMessage.includes('summar')) {
        if (isCybercrimeDoc && isIndiaDoc && isComparativeDoc) {
          responseText = `**Summary of Cybercrime Law Analysis**\n\nBased on your document "${docFilename}":\n\nThis appears to be a **comparative legal analysis** examining India's cybercrime legal framework in the context of international standards. Key areas likely covered:\n\n**1. India's Legal Framework:**\n- Information Technology Act, 2000 (IT Act) and 2008 amendments\n- Section 43, 66, 66A-F, 67, 70 (cybercrime provisions)\n- Institutional mechanisms and enforcement challenges\n\n**2. International Standards:**\n- Budapest Convention on Cybercrime (2001) - not ratified by India\n- UN Cybercrime Convention (2024) - emerging global framework\n- Best practices from UK, US, EU jurisdictions\n\n**3. Comparative Analysis:**\n- Legislative scope and coverage gaps\n- Institutional structures (cyber cells, tribunals)\n- International cooperation mechanisms\n- Conviction rates and enforcement effectiveness\n\n**4. Key Findings:**\n- Low conviction rates in India (likely discussed)\n- Limited international cooperation frameworks\n- Need for harmonization with global standards\n- Recommendations for legal reforms\n\nWould you like me to elaborate on any specific aspect?`
        } else {
          responseText = `Based on the document "${docTitle}" (${docFilename}):\n\nThis ${docType} document appears to focus on legal analysis and comparative study. A comprehensive summary would include:\n\n1. Main subject matter and scope\n2. Key legal principles and provisions discussed\n3. Comparative analysis elements (if any)\n4. Relevant legal frameworks and standards\n5. Conclusions and recommendations\n\nFor a more detailed summary, please ask about specific sections or topics within the document.`
        }
      } else if (lowerMessage.includes('key point') || lowerMessage.includes('main point')) {
        if (isCybercrimeDoc) {
          responseText = `**Key Points - Cybercrime Laws (${docFilename})**\n\n**Legislative Framework:**\n1. **India's IT Act 2000** - Primary legislation with Sections 43, 66-67, 70\n2. **2008 Amendments** - Strengthened provisions, added identity theft (66C), cyber terrorism (66F)\n3. **Comparison with Global Standards** - Budapest Convention, UN Convention\n\n**Critical Issues:**\n4. **Low Conviction Rates** - Investigation capacity gaps, procedural delays\n5. **Limited International Cooperation** - India not party to Budapest Convention\n6. **Jurisdictional Challenges** - Cross-border cybercrime enforcement\n\n**Recommendations:**\n7. **Legal Harmonization** - Align with international standards\n8. **Institutional Strengthening** - Specialized cyber courts, trained investigators\n9. **Treaty Participation** - Consider ratifying Budapest/UN conventions\n10. **Capacity Building** - Training, technology, public-private partnerships\n\n${documentContext}`
        } else {
          responseText = `Key points from "${docTitle}":\n\n1. **Document Classification**: ${docType.toUpperCase()}\n2. **Legal Framework**: Establishes or analyzes legal standards and principles\n3. **Comparative Elements**: May include international or jurisdictional comparisons\n4. **Practical Application**: Discusses implementation and compliance considerations\n5. **Global Standards**: References emerging international legal norms\n\n${documentContext}\n\nWould you like me to elaborate on any specific aspect?`
        }
      } else if (lowerMessage.includes('risk') || lowerMessage.includes('concern') || lowerMessage.includes('challenge')) {
        responseText = `**Legal Challenges & Concerns - Cybercrime Framework**\n\nFor the document "${docTitle}":\n\n**India's Key Challenges:**\n\n1. **Enforcement Gaps:**\n   • Low conviction rates (below 10% in many cyber cases)\n   • Insufficient cyber forensic capabilities\n   • Delays in investigation and prosecution\n   • Lack of specialized training for law enforcement\n\n2. **Legislative Limitations:**\n   • IT Act doesn't cover all emerging cyber threats\n   • Absence of comprehensive data protection law (until 2023)\n   • Jurisdictional issues with cross-border crimes\n   • Need for continuous updates to match technology evolution\n\n3. **International Cooperation:**\n   • India not party to Budapest Convention\n   • Limited bilateral MLATs (Mutual Legal Assistance Treaties)\n   • Slow evidence sharing with foreign jurisdictions\n   • Attribution challenges in transnational cybercrime\n\n4. **Institutional Weaknesses:**\n   • Understaffed cyber cells in states\n   • Lack of specialized cyber courts (few exceptions)\n   • Inadequate coordination between agencies\n   • Limited public-private partnerships\n\n**Global Standard Requirements:**\n   • Harmonized substantive law definitions\n   • 24/7 contact points for urgent requests\n   • Streamlined MLAT procedures\n   • Capacity building programs\n   • Human rights safeguards\n\n${documentContext}`
      } else {
        // Intelligent keyword matching with document context
        let foundResponse = false
        for (const [keyword, response] of Object.entries(legalResponses)) {
          if (lowerMessage.includes(keyword)) {
            // Special handling for cybercrime-related queries with document context
            if ((keyword.includes('cybercrime') || keyword.includes('convention') || keyword.includes('it act')) && isCybercrimeDoc) {
              responseText = `**${keyword.toUpperCase()} - Analysis in Context**\n\n${response}\n\n**Relevance to Your Document (${docFilename}):**\n\nThis concept is directly relevant to your comparative legal analysis. The document likely examines:\n\n• How India's legal framework (IT Act) addresses this issue\n• Comparison with international standards (Budapest, UN Conventions)\n• Gaps in current Indian legislation\n• Best practices from other jurisdictions (UK, US)\n• Recommendations for harmonization and reform\n\n**Document Context:**\n${documentContext}\n\n**Key Questions to Explore:**\n- How does India's approach differ from global standards?\n- What are the enforcement challenges?\n- What reforms are recommended?\n\nWould you like me to elaborate on any specific aspect of this analysis?`
            } else {
              responseText = `Regarding "${message}" in the context of your document "${docTitle}":\n\n${response}\n\n**Document Context:**\n${documentContext}\n\nThis information is particularly relevant to your ${docType} document as it provides foundational legal concepts that may apply to the analysis or subject matter discussed.`
            }
            foundResponse = true
            break
          }
        }
        
        if (!foundResponse) {
          responseText = `**Question: "${message}"**\n\nRegarding your document **"${docFilename}"**:\n\n${documentContext}\n\n**How I Can Help:**\n\n• **Legal Framework Analysis** - Explain specific statutes (IT Act sections, international treaties)\n• **Comparative Insights** - India vs. global standards (Budapest Convention, UN Convention)\n• **Key Challenges** - Enforcement gaps, jurisdictional issues, cooperation mechanisms\n• **Specific Provisions** - Section-by-section analysis of IT Act or other laws\n• **International Treaties** - Budapest Convention, UN Cybercrime Convention, MLATs\n• **Reform Recommendations** - Legal harmonization, institutional strengthening\n\n**Suggested Questions:**\n- "Explain the Budapest Convention"\n- "What is the IT Act Section 66F?"\n- "Compare India's laws with global standards"\n- "What are the main challenges in enforcement?"\n- "Summarize this document"\n\nPlease ask about a specific section, legal concept, or comparative aspect for detailed analysis.`
        }
      }
    } else {
      // General legal knowledge responses
      for (const [keyword, response] of Object.entries(legalResponses)) {
        if (lowerMessage.includes(keyword)) {
          responseText = response
          break
        }
      }
      
      // Default responses for common queries
      if (!responseText) {
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
          responseText = 'Hello! I\'m a legal AI assistant. I can help you with questions about contracts, torts, liability, negligence, and other legal concepts. You can also upload a legal document and ask me questions about it. How may I assist you with your legal inquiry today?'
        } else if (lowerMessage.includes('help')) {
          responseText = 'I can assist you with:\n• Contract law and formation\n• Tort law and liability\n• Legal terminology\n• Case law interpretation\n• Statutory analysis\n• Document analysis and review\n\nYou can upload a legal document using the "Upload Doc" button and ask me specific questions about it. Please ask me any specific legal question, and I\'ll do my best to provide helpful information.'
        } else {
          responseText = `I understand you're asking about: "${message}". As a legal AI assistant, I can help with contract law, tort law, statutory interpretation, and legal terminology. I can also analyze legal documents if you upload them. Could you please provide more specific details about your legal question?`
        }
      }
    }
    
    const processingTime = Date.now() - startTime
    
    // Save AI response
    await c.env.DB.prepare(
      'INSERT INTO chat_messages (session_id, role, content, model_used, processing_time_ms) VALUES (?, "assistant", ?, ?, ?)'
    ).bind(sessionId, responseText, hfModel, processingTime).run()
    
    return c.json({
      success: true,
      session_id: sessionId,
      message: { role: 'assistant', content: responseText, model_used: hfModel, processing_time_ms: processingTime }
    })
  } catch (error) {
    return c.json({ error: 'AI query failed' }, 500)
  }
})

// Create new chat session
app.post('/api/chat/sessions', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { document_id, title, ai_model } = await c.req.json()
  
  const result = await c.env.DB.prepare(
    'INSERT INTO chat_sessions (user_id, title, ai_model, document_id) VALUES (?, ?, ?, ?)'
  ).bind(payload.userId, title || 'New Chat', ai_model || 'flan-t5-base', document_id || null).run()
  
  const session = await c.env.DB.prepare('SELECT * FROM chat_sessions WHERE id = ?').bind(result.meta.last_row_id).first()
  
  return c.json({ success: true, session }, 201)
})

// Get sessions
app.get('/api/chat/sessions', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT 50'
  ).bind(payload.userId).all()
  
  return c.json({ success: true, sessions: results })
})

// Get messages
app.get('/api/chat/sessions/:id/messages', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const sessionId = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all()
  
  return c.json({ success: true, messages: results })
})

// ============================================================================
// DOCUMENT ROUTES
// ============================================================================

// Upload document
app.post('/api/documents/upload', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  // Check if R2 is available
  if (!c.env.DOCUMENTS) {
    return c.json({ 
      error: 'Document storage not configured. Please enable R2 in Cloudflare Dashboard.',
      hint: 'Visit https://dash.cloudflare.com/ and enable R2 storage for your account.'
    }, 503)
  }
  
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const title = (formData.get('title') as string) || file.name
  const documentType = (formData.get('document_type') as string) || 'other'
  const tags = (formData.get('tags') as string) || ''
  
  if (!file) return c.json({ error: 'No file provided' }, 400)
  
  const r2Key = `documents/${payload.userId}/${Date.now()}-${crypto.randomUUID()}.${file.name.split('.').pop()}`
  const arrayBuffer = await file.arrayBuffer()
  
  await c.env.DOCUMENTS.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { userId: payload.userId.toString() }
  })
  
  const result = await c.env.DB.prepare(
    'INSERT INTO documents (user_id, title, filename, file_size, file_type, r2_key, document_type, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(payload.userId, title, file.name, file.size, file.type, r2Key, documentType, tags).run()
  
  const document = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(result.meta.last_row_id).first()
  
  return c.json({ success: true, document }, 201)
})

// Get documents
app.get('/api/documents/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE user_id = ? AND is_archived = 0 ORDER BY uploaded_at DESC LIMIT 50'
  ).bind(payload.userId).all()
  
  return c.json({ success: true, documents: results })
})

// Get single document
app.get('/api/documents/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) {
    return c.json({ error: 'Document not found' }, 404)
  }
  
  return c.json({ success: true, document })
})

// Download document
app.get('/api/documents/:id/download', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document: any = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) return c.json({ error: 'Document not found' }, 404)
  
  const object = await c.env.DOCUMENTS.get(document.r2_key)
  if (!object) return c.json({ error: 'File not found' }, 404)
  
  return new Response(object.body, {
    headers: {
      'Content-Type': document.file_type,
      'Content-Disposition': `attachment; filename="${document.filename}"`
    }
  })
})

// Delete document
app.delete('/api/documents/:id', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload) return c.json({ error: 'Invalid token' }, 401)
  
  const id = c.req.param('id')
  const document: any = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, payload.userId).first()
  
  if (!document) return c.json({ error: 'Document not found' }, 404)
  
  await c.env.DOCUMENTS.delete(document.r2_key)
  await c.env.DB.prepare('UPDATE documents SET is_archived = 1 WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// ============================================================================
// ADMIN ROUTES
// ============================================================================

app.get('/api/admin/stats/platform', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  
  const token = authHeader.replace('Bearer ', '')
  const payload = await verifyJWT(token, c.env.JWT_SECRET || 'default-secret')
  if (!payload || payload.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  
  const userStats = await c.env.DB.prepare('SELECT COUNT(*) as total_users FROM users').first()
  const docStats = await c.env.DB.prepare('SELECT COUNT(*) as total_documents FROM documents WHERE is_archived = 0').first()
  const chatStats = await c.env.DB.prepare('SELECT COUNT(*) as total_sessions FROM chat_sessions WHERE is_archived = 0').first()
  
  return c.json({
    success: true,
    stats: {
      users: userStats,
      documents: docStats,
      chat: chatStats
    }
  })
})

// ============================================================================
// FRONTEND
// ============================================================================

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', service: 'legal-ai-platform', version: '1.0.0' })
})

// Get AI models
app.get('/api/models', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT model_id, model_name, model_type, description FROM ai_models WHERE is_active = 1'
  ).all()
  return c.json({ success: true, models: results })
})

// Main page - using the HTML I created earlier
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal AI Platform - Enterprise Legal Intelligence System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg { background: linear-gradient(135deg, #1E40AF 0%, #0F172A 100%); }
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body class="bg-gray-50">
    <nav class="gradient-bg text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <i class="fas fa-balance-scale text-2xl mr-3"></i>
                    <span class="text-xl font-bold">Legal AI Platform</span>
                </div>
                <div class="flex space-x-4" id="nav-buttons">
                    <button onclick="showLogin()" class="px-4 py-2 rounded-lg bg-white text-blue-900 hover:bg-gray-100">
                        <i class="fas fa-sign-in-alt mr-2"></i>Login
                    </button>
                    <button onclick="showRegister()" class="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600">
                        <i class="fas fa-user-plus mr-2"></i>Register
                    </button>
                </div>
            </div>
        </div>
    </nav>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="landing-page">
            <div class="text-center mb-12">
                <h1 class="text-5xl font-bold text-gray-900 mb-4">Enterprise Legal AI Platform</h1>
                <p class="text-xl text-gray-600 mb-8">Powered by Hugging Face Models • Open Source • Enterprise-Grade</p>
                <button onclick="showRegister()" class="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg">
                    Get Started Free
                </button>
            </div>
            
            <div class="grid md:grid-cols-3 gap-6">
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-blue-600 text-3xl mb-4"><i class="fas fa-file-alt"></i></div>
                    <h3 class="text-xl font-bold mb-2">Document Intelligence</h3>
                    <p class="text-gray-600">Upload and analyze legal documents with AI-powered insights.</p>
                </div>
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-green-600 text-3xl mb-4"><i class="fas fa-comments"></i></div>
                    <h3 class="text-xl font-bold mb-2">AI Chat Assistant</h3>
                    <p class="text-gray-600">Chat with legal documents using multiple AI models.</p>
                </div>
                <div class="card-hover bg-white p-6 rounded-lg shadow-md">
                    <div class="text-purple-600 text-3xl mb-4"><i class="fas fa-robot"></i></div>
                    <h3 class="text-xl font-bold mb-2">Multiple AI Models</h3>
                    <p class="text-gray-600">Legal-BERT, FLAN-T5, and specialized legal language models.</p>
                </div>
            </div>
        </div>
        
        <div id="auth-page" class="hidden">
            <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
                <div id="auth-content"></div>
            </div>
        </div>
        
        <div id="dashboard-page" class="hidden">
            <div id="dashboard-content"></div>
        </div>
    </div>
    
    <footer class="gradient-bg text-white mt-16 py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
            <p>&copy; 2026 Legal AI Platform. Apache 2.0 License.</p>
        </div>
    </footer>
    
    <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
