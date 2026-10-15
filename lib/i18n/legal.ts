/**
 * Legal copy (Terms of Service, Privacy Policy) in both languages.
 *
 * Launch rewrite 2026-10-15: the text describes the launch product only
 * (personalized children's books) and was checked against the implementation
 * it describes (plan numbers: lib/entitlements/policy.ts TIER_CAPS and
 * lib/plans/config.ts; sharing: app/api/story/status/route.ts; archive:
 * app/api/story/[requestId]/archive; storage: CookieBanner, i18n context,
 * submit route guest_token; email: app/api/cron/drip-emails and
 * marketing_email_suppressions; payments: lib/stripe/*). If one of those
 * changes, this text must change with it. Do not add governing law, venue,
 * arbitration, retention periods or deletion deadlines without a founder
 * decision (see audits/legal-rewrite-2026-10-15/completion-report.md).
 *
 * The English text is the authoritative policy. The Spanish text is a
 * faithful translation of the same rules — never a different policy — with
 * identical section order and block structure (lib/i18n/i18n.test.ts).
 * Sections flagged `beta` render only while Beta Mode is on.
 */
import type { Lang } from './index.ts'

export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { strong: string }
  | { contact: string }

export interface LegalSection {
  title: string
  beta?: boolean
  blocks: LegalBlock[]
  /** Extra bullet shown inside this section only while Beta Mode is on. */
  betaBullet?: string
}

export interface LegalDoc {
  title: string
  updated: string
  operator: string
  sections: LegalSection[]
}

const CONTACT = 'contact@nestandquill.com'

const UPDATED_EN = 'Last updated: October 15, 2026'
const UPDATED_ES = 'Última actualización: 15 de octubre de 2026'
const OPERATOR_EN = 'Nest & Quill is operated by Digital Official & Huerta Group.'
const OPERATOR_ES = 'Nest & Quill es operado por Digital Official & Huerta Group.'

// ── Terms of Service ─────────────────────────────────────────────────────────

const termsEn: LegalDoc = {
  title: 'Terms of Service',
  updated: UPDATED_EN,
  operator: OPERATOR_EN,
  sections: [
    { title: 'About These Terms', blocks: [
      { p: 'These Terms of Service (“Terms”) govern your use of the Nest & Quill website and story service (the “Service”). Nest & Quill is operated by Digital Official & Huerta Group (“we”, “us”, “our”).' },
      { p: 'By using the Service, creating a story, creating an account, or buying a plan, you agree to these Terms. If you do not agree, please do not use the Service. Our Privacy Policy explains how we handle information and should be read together with these Terms.' },
    ] },
    { title: 'Who May Use Nest & Quill', blocks: [
      { p: 'Nest & Quill is a service for adults, such as parents, guardians and other family members, who create personalized books for children. You must be an adult age 18 or older to create an account, submit a story, or buy a plan.' },
      { p: 'Children should not create accounts or use the Service on their own. Children can enjoy finished books with the adults who choose to share them.' },
    ] },
    { title: 'The Service', blocks: [
      { p: 'Nest & Quill creates personalized, illustrated children’s books. An adult answers questions about a child and the story they want, and the Service uses artificial intelligence to write the story and create its illustrations. Finished books can be read online through a story link and are sent by email; plans that include PDF downloads also let you download a PDF of the book.' },
      { p: 'The Service currently offers personalized children’s books only. Other products or features that may have appeared in earlier versions of these Terms or on earlier versions of our website (for example classroom, homeschool, learning-tool, writing, publishing, printing, teen-reader or adult-reader products) are not offered as part of the Service and are not covered by these Terms.' },
    ] },
    { title: 'Accounts and Guest Stories', blocks: [
      { ul: [
        'You can create one Free book as a guest, without an account, by giving us an email address. A guest token stored in your browser lets you follow that story.',
        'If you later create an account, a guest book linked to your browser or to your confirmed email address may be added to your account. A guest book added this way counts toward your account’s Free allowance.',
        'Accounts use an email address and a password. You must give accurate information, keep your password secure, and you are responsible for activity on your account.',
        'We may suspend or close an account, remove content, or refuse service if these Terms are violated or if it is needed to protect the Service or other people.',
      ] },
    ] },
    { title: 'Information About Children and Other People', blocks: [
      { p: 'To personalize a book you give us information about a child and, if you choose, about other people, such as siblings, friends or relatives. Before a story is submitted, you must confirm that:' },
      { ul: [
        'you are an adult;',
        'you are the child’s parent or legal guardian, or you have permission from the child’s parent or legal guardian to provide this information; and',
        'you have permission to provide information about any other people included in the story.',
      ] },
      { p: 'This confirmation is your own statement. We record that it was given, but we do not verify anyone’s identity, age or family relationship. Please share only what the story needs, and do not include sensitive details such as home addresses, school names, health information or account numbers.' },
    ] },
    { title: 'Plans and Allowances', blocks: [
      { p: 'The current plans are:' },
      { ul: [
        'Free: personalized 8-page books at no charge, with no payment card required. A guest can create 1 Free book. Each account has a total Free allowance of 2 books, and a guest book that is later added to the account counts toward those 2.',
        'Single Story: one book of up to 16 pages for a one-time price of $7.99.',
        'Story Pack: $9.99 per month for up to 3 books in each monthly subscription period, each book up to 24 pages.',
        'Story Pro: $24.99 per month for up to 6 books in each monthly subscription period, each book up to 32 pages.',
      ] },
      { p: 'Other plan features, such as illustration styles, dedications and PDF downloads, are described on the Pricing page. Prices are in U.S. dollars. There is no annual billing. We do not offer printed books or priority processing.' },
    ] },
    { title: 'Payments and Refunds', betaBullet: 'During beta, paid plans may be available at no charge while we evaluate the experience.', blocks: [
      { ul: [
        'Paid plans can be bought only when online checkout is available. Payments are handled on a checkout page hosted by our payment processor, Stripe. We do not receive or store your full card number.',
        'Buying a plan requires an account. An account can have one active subscription at a time.',
        'Single Story is a one-time payment. Story Pack and Story Pro are monthly subscriptions billed in advance.',
        'Books are added to your account only after our payment processor confirms the payment.',
        'We may offer promotion codes. Any conditions are shown when the code is offered.',
        'We may change prices. A change does not affect a period or book you have already paid for, and we will give reasonable notice before a new price applies to a subscription renewal.',
        'Refunds and other remedies are described under “Generation Problems and Refunds” below.',
      ] },
      { p: 'Online checkout may not be available yet. Until it is, no one is charged through the Service, and these payment and subscription terms apply from the time paid plans are offered.' },
    ] },
    { title: 'Monthly Subscriptions', blocks: [
      { ul: [
        'Story Pack and Story Pro renew automatically every month, and your payment method is charged at the start of each subscription period until you cancel.',
        'Each subscription period includes the number of books for your plan. Unused books do not roll over to the next period.',
        'You can cancel at any time with “Manage billing” on your account page, or by contacting us. Cancellation stops future renewals. The period you have already paid for stays available until it ends, including any books left in it.',
        'Canceling does not automatically refund the current period.',
        'If a renewal payment fails, a period you have already paid for stays available until it ends, but a new period and its books start only after that period’s payment succeeds. Our payment processor may retry a failed payment, and the subscription may end if payment cannot be collected.',
      ] },
    ] },
    { title: 'Generation Problems and Refunds', blocks: [
      { p: 'Story creation is automated and can occasionally fail or produce a book that is not usable. When a story fails, the Service may offer you a retry.' },
      { p: 'If you have a problem with a paid book, contact us. Depending on the situation, we may regenerate or replace the book, resolve the problem another way, or issue a refund where appropriate. Refunds and replacements are not automatic, and a book used from a purchase or subscription period is not automatically restored when generation fails.' },
      { p: 'Free books that fail permanently may be handled differently by the system, and in some cases the Free book becomes available to use again.' },
    ] },
    { title: 'Your Books and License', blocks: [
      { p: 'Every book generated for you, whether on the Free plan or a paid plan, comes with the same license: a personal, non-exclusive, non-transferable license to read the book, download it where your plan includes PDF downloads, print it for yourself, and share it with family and friends, for personal, non-commercial purposes.' },
      { p: 'This license does not allow you to sell, resell, sublicense or commercially publish a book, its characters or its illustrations, or to use them on merchandise or in any commercial product, without our written permission.' },
      { p: 'Buying a plan or a book does not transfer ownership of the Nest & Quill website, software, AI systems and configurations, prompts, templates, designs, branding or other technology. We and our licensors keep all rights in them.' },
      { p: 'You keep whatever rights you have in the information you provide. You allow us to use it to create, deliver, store and support your books and to operate the Service as described in our Privacy Policy.' },
      { p: 'Because books are generated with AI, similar text or images may be produced for other customers, and illustrations are artistic interpretations, not likenesses of real people.' },
    ] },
    { title: 'Story Links and Sharing', blocks: [
      { p: 'Each finished story has its own web address (a “story link”). Anyone who has the link can open and read the finished story without signing in and, where a PDF of the book has already been created, may also be able to download it. A story link is not password-protected.' },
      { ul: [
        'Share a story link only with people you want to see the story.',
        'People who receive a link can forward it, which gives access to anyone they send it to.',
        'Archiving a story does not turn off its link.',
        'If a link has been shared more widely than you intended, contact us.',
      ] },
    ] },
    { title: 'Archive and Deletion', blocks: [
      { p: 'You can archive stories in your account, which hides them from your library. Archiving is not deletion: an archived story, its text, illustrations and any PDF remain stored, its story link keeps working, and you can restore it.' },
      { p: 'There is currently no self-service way to permanently delete a story or an account. To ask us to delete a story, your account or other information, contact us. Our Privacy Policy explains how we handle these requests and what information may be kept.' },
    ] },
    { title: 'AI-Generated Content', blocks: [
      { p: 'Stories and illustrations are generated automatically with artificial intelligence provided by a third-party AI service, and they are not reviewed by a person before delivery. AI-generated content can contain mistakes, inconsistencies or unexpected results. Please review each book before sharing it with a child. We do not guarantee that generated content will be accurate, error-free or suitable for every child.' },
      { p: 'The chat assistant on our website is also powered by AI and can give incomplete or incorrect answers. The Pricing page and these Terms take priority over anything the assistant says.' },
    ] },
    { title: 'Acceptable Use', blocks: [
      { p: 'You agree not to use the Service to:' },
      { ul: [
        'Create harmful, abusive, sexual, discriminatory or illegal content',
        'Enter inappropriate or unsafe material',
        'Provide information about a child or another person without the permission described above',
        'Access stories, accounts or data that are not yours or were not shared with you',
        'Reverse engineer, scrape or copy the Service',
        'Use bots or automation to abuse the Service or its limits',
        'Impersonate another person or entity',
        'Violate any applicable law',
      ] },
      { p: 'We may remove content or restrict access if these rules are violated.' },
    ] },
    { title: 'Beta Period', beta: true, blocks: [
      { p: 'The Service is currently in beta. During this period:' },
      { ul: [
        'Paid plans may be available at no charge while we evaluate the experience. We will tell users in advance before billing starts.',
        'Some capabilities, such as illustration generation, may be paused or limited to control costs. Stories may be delivered as text only during those times.',
        'Features may be added, changed or removed without prior notice.',
      ] },
    ] },
    { title: 'Changes to the Service', blocks: [
      { p: 'We may change, suspend or discontinue parts of the Service at any time.' },
    ] },
    { title: 'Limitation of Liability', blocks: [
      { p: 'To the maximum extent permitted by law, Nest & Quill and its operator are not liable for indirect, incidental or consequential damages arising from use of the Service.' },
      { p: 'Total liability shall not exceed the amount you paid in the 12 months before the claim.' },
    ] },
    { title: 'Changes to These Terms', blocks: [
      { p: 'We may update these Terms. When we do, we will post the new version on this page with a new “Last updated” date. If you continue to use the Service after an update, the updated Terms apply.' },
    ] },
    { title: 'Contact', blocks: [{ contact: 'For questions about these Terms, or if you have a concern about the Service or a charge, contact us first so we can try to resolve it:' }] },
  ],
}

const termsEs: LegalDoc = {
  title: 'Términos de servicio',
  updated: UPDATED_ES,
  operator: OPERATOR_ES,
  sections: [
    { title: 'Acerca de estos términos', blocks: [
      { p: 'Estos Términos de servicio (“Términos”) rigen el uso del sitio web y del servicio de cuentos de Nest & Quill (el “Servicio”). Nest & Quill es operado por Digital Official & Huerta Group (“nosotros”).' },
      { p: 'Al usar el Servicio, crear un cuento, crear una cuenta o comprar un plan, aceptas estos Términos. Si no estás de acuerdo, por favor no uses el Servicio. Nuestra Política de privacidad explica cómo tratamos la información y debe leerse junto con estos Términos.' },
    ] },
    { title: 'Quién puede usar Nest & Quill', blocks: [
      { p: 'Nest & Quill es un servicio para personas adultas, como padres, madres, tutores y otros familiares, que crean libros personalizados para niños. Debes ser una persona adulta de 18 años o más para crear una cuenta, enviar un cuento o comprar un plan.' },
      { p: 'Los niños no deben crear cuentas ni usar el Servicio por su cuenta. Los niños pueden disfrutar los libros terminados con las personas adultas que decidan compartirlos.' },
    ] },
    { title: 'El Servicio', blocks: [
      { p: 'Nest & Quill crea libros infantiles personalizados e ilustrados. Una persona adulta responde preguntas sobre un niño o una niña y el cuento que desea, y el Servicio usa inteligencia artificial para escribir el cuento y crear sus ilustraciones. Los libros terminados se pueden leer en línea mediante un enlace del cuento y se envían por correo electrónico; los planes que incluyen descargas en PDF también permiten descargar un PDF del libro.' },
      { p: 'Actualmente el Servicio ofrece únicamente libros infantiles personalizados. Otros productos o funciones que puedan haber aparecido en versiones anteriores de estos Términos o de nuestro sitio web (por ejemplo, productos para el salón de clases, educación en casa, herramientas de aprendizaje, escritura, publicación, impresión, lectores adolescentes o lectores adultos) no se ofrecen como parte del Servicio y no están cubiertos por estos Términos.' },
    ] },
    { title: 'Cuentas y cuentos como invitado', blocks: [
      { ul: [
        'Puedes crear un libro Free como invitado, sin cuenta, indicándonos una dirección de correo electrónico. Un identificador de invitado guardado en tu navegador te permite seguir ese cuento.',
        'Si más adelante creas una cuenta, un libro de invitado vinculado a tu navegador o a tu correo electrónico confirmado puede añadirse a tu cuenta. Un libro de invitado añadido de esta forma cuenta para el límite Free de tu cuenta.',
        'Las cuentas usan una dirección de correo electrónico y una contraseña. Debes proporcionar información precisa y mantener segura tu contraseña, y eres responsable de la actividad de tu cuenta.',
        'Podemos suspender o cerrar una cuenta, eliminar contenido o negar el servicio si se infringen estos Términos o si es necesario para proteger el Servicio o a otras personas.',
      ] },
    ] },
    { title: 'Información sobre niños y otras personas', blocks: [
      { p: 'Para personalizar un libro nos das información sobre un niño o una niña y, si lo deseas, sobre otras personas, como hermanos, amigos o familiares. Antes de enviar un cuento, debes confirmar que:' },
      { ul: [
        'eres una persona adulta;',
        'eres el padre, la madre o el tutor legal del niño o la niña, o tienes permiso de su padre, madre o tutor legal para proporcionar esta información; y',
        'tienes permiso para proporcionar información sobre cualquier otra persona incluida en el cuento.',
      ] },
      { p: 'Esta confirmación es una declaración tuya. Registramos que se dio, pero no verificamos la identidad, la edad ni el parentesco de nadie. Comparte solo lo que el cuento necesita y no incluyas datos sensibles como domicilios, nombres de escuelas, información de salud o números de cuenta.' },
    ] },
    { title: 'Planes y límites', blocks: [
      { p: 'Los planes actuales son:' },
      { ul: [
        'Free: libros personalizados de 8 páginas sin costo y sin tarjeta de pago. Un invitado puede crear 1 libro Free. Cada cuenta tiene un límite total de 2 libros Free, y un libro de invitado que después se añada a la cuenta cuenta para esos 2.',
        'Single Story: un libro de hasta 16 páginas por un pago único de $7.99.',
        'Story Pack: $9.99 al mes por hasta 3 libros en cada periodo mensual de suscripción, cada libro de hasta 24 páginas.',
        'Story Pro: $24.99 al mes por hasta 6 libros en cada periodo mensual de suscripción, cada libro de hasta 32 páginas.',
      ] },
      { p: 'Otras características de los planes, como los estilos de ilustración, las dedicatorias y las descargas en PDF, se describen en la página de Precios. Los precios están en dólares estadounidenses. No hay facturación anual. No ofrecemos libros impresos ni procesamiento prioritario.' },
    ] },
    { title: 'Pagos y reembolsos', betaBullet: 'Durante la beta, los planes de pago pueden estar disponibles sin costo mientras evaluamos la experiencia.', blocks: [
      { ul: [
        'Los planes de pago solo se pueden comprar cuando el pago en línea está disponible. Los pagos se gestionan en una página de pago alojada por nuestro procesador de pagos, Stripe. No recibimos ni almacenamos el número completo de tu tarjeta.',
        'Comprar un plan requiere una cuenta. Una cuenta puede tener una sola suscripción activa a la vez.',
        'Single Story es un pago único. Story Pack y Story Pro son suscripciones mensuales que se cobran por adelantado.',
        'Los libros se añaden a tu cuenta solo después de que nuestro procesador de pagos confirma el pago.',
        'Podemos ofrecer códigos promocionales. Cualquier condición se muestra cuando se ofrece el código.',
        'Podemos cambiar los precios. Un cambio no afecta a un periodo o libro que ya hayas pagado, y avisaremos con anticipación razonable antes de que un nuevo precio se aplique a la renovación de una suscripción.',
        'Los reembolsos y otras soluciones se describen más abajo, en “Problemas de generación y reembolsos”.',
      ] },
      { p: 'Es posible que el pago en línea aún no esté disponible. Mientras no lo esté, no se cobra a nadie a través del Servicio, y estos términos de pago y suscripción se aplican desde el momento en que se ofrezcan los planes de pago.' },
    ] },
    { title: 'Suscripciones mensuales', blocks: [
      { ul: [
        'Story Pack y Story Pro se renuevan automáticamente cada mes, y se cobra a tu método de pago al inicio de cada periodo de suscripción hasta que canceles.',
        'Cada periodo de suscripción incluye el número de libros de tu plan. Los libros no usados no se acumulan para el siguiente periodo.',
        'Puedes cancelar en cualquier momento con “Administrar pagos” en la página de tu cuenta, o contactándonos. La cancelación detiene las renovaciones futuras. El periodo que ya pagaste sigue disponible hasta que termina, incluidos los libros que te queden en él.',
        'Cancelar no reembolsa automáticamente el periodo en curso.',
        'Si falla el pago de una renovación, el periodo que ya pagaste sigue disponible hasta que termina, pero un nuevo periodo y sus libros comienzan solo cuando el pago de ese periodo se completa. Nuestro procesador de pagos puede reintentar un pago fallido, y la suscripción puede terminar si no se logra cobrar.',
      ] },
    ] },
    { title: 'Problemas de generación y reembolsos', blocks: [
      { p: 'La creación de cuentos es automática y en ocasiones puede fallar o producir un libro que no se puede usar. Cuando un cuento falla, el Servicio puede ofrecerte un reintento.' },
      { p: 'Si tienes un problema con un libro de pago, contáctanos. Según la situación, podemos volver a generar o reemplazar el libro, resolver el problema de otra forma o emitir un reembolso cuando corresponda. Los reembolsos y reemplazos no son automáticos, y un libro usado de una compra o de un periodo de suscripción no se restituye automáticamente cuando la generación falla.' },
      { p: 'Los libros Free que fallan de forma definitiva pueden tratarse de otra manera en el sistema y, en algunos casos, el libro Free vuelve a estar disponible para usarse.' },
    ] },
    { title: 'Tus libros y la licencia', blocks: [
      { p: 'Cada libro generado para ti, ya sea con el plan Free o con un plan de pago, incluye la misma licencia: una licencia personal, no exclusiva e intransferible para leer el libro, descargarlo cuando tu plan incluya descargas en PDF, imprimirlo para ti y compartirlo con familiares y amigos, con fines personales y no comerciales.' },
      { p: 'Esta licencia no te permite vender, revender, sublicenciar ni publicar comercialmente un libro, sus personajes o sus ilustraciones, ni usarlos en mercancía o en cualquier producto comercial, sin nuestro permiso por escrito.' },
      { p: 'Comprar un plan o un libro no transfiere la propiedad del sitio web, el software, los sistemas y configuraciones de IA, las instrucciones (prompts), las plantillas, los diseños, la marca ni ninguna otra tecnología de Nest & Quill. Nosotros y nuestros licenciantes conservamos todos los derechos sobre ellos.' },
      { p: 'Conservas los derechos que tengas sobre la información que proporcionas. Nos permites usarla para crear, entregar, almacenar y dar soporte a tus libros y para operar el Servicio como se describe en nuestra Política de privacidad.' },
      { p: 'Como los libros se generan con IA, se pueden producir textos o imágenes similares para otros clientes, y las ilustraciones son interpretaciones artísticas, no retratos de personas reales.' },
    ] },
    { title: 'Enlaces de los cuentos y cómo compartirlos', blocks: [
      { p: 'Cada cuento terminado tiene su propia dirección web (un “enlace del cuento”). Cualquier persona que tenga el enlace puede abrir y leer el cuento terminado sin iniciar sesión y, si ya se creó un PDF del libro, también puede descargarlo. Un enlace del cuento no está protegido con contraseña.' },
      { ul: [
        'Comparte el enlace de un cuento solo con las personas que quieras que lo vean.',
        'Quienes reciben un enlace pueden reenviarlo, lo que da acceso a cualquier persona a quien se lo envíen.',
        'Archivar un cuento no desactiva su enlace.',
        'Si un enlace se compartió más de lo que querías, contáctanos.',
      ] },
    ] },
    { title: 'Archivo y eliminación', blocks: [
      { p: 'Puedes archivar cuentos en tu cuenta, lo que los oculta de tu biblioteca. Archivar no es eliminar: un cuento archivado, su texto, sus ilustraciones y cualquier PDF siguen almacenados, su enlace sigue funcionando y puedes restaurarlo.' },
      { p: 'Actualmente no existe una forma de eliminar de manera permanente un cuento o una cuenta por tu cuenta. Para pedirnos que eliminemos un cuento, tu cuenta u otra información, contáctanos. Nuestra Política de privacidad explica cómo atendemos estas solicitudes y qué información puede conservarse.' },
    ] },
    { title: 'Contenido generado por IA', blocks: [
      { p: 'Los cuentos y las ilustraciones se generan automáticamente con inteligencia artificial de un servicio de IA de terceros y no son revisados por una persona antes de entregarse. El contenido generado por IA puede contener errores, incoherencias o resultados inesperados. Revisa cada libro antes de compartirlo con un niño o una niña. No garantizamos que el contenido generado sea preciso, libre de errores o adecuado para todos los niños.' },
      { p: 'El asistente de chat de nuestro sitio web también funciona con IA y puede dar respuestas incompletas o incorrectas. La página de Precios y estos Términos prevalecen sobre cualquier cosa que diga el asistente.' },
    ] },
    { title: 'Uso aceptable', blocks: [
      { p: 'Te comprometes a no usar el Servicio para:' },
      { ul: [
        'Crear contenido dañino, abusivo, sexual, discriminatorio o ilegal',
        'Ingresar material inapropiado o inseguro',
        'Proporcionar información sobre un niño, una niña u otra persona sin el permiso descrito arriba',
        'Acceder a cuentos, cuentas o datos que no son tuyos o que no se compartieron contigo',
        'Realizar ingeniería inversa, extraer datos o copiar el Servicio',
        'Usar bots o automatización para abusar del Servicio o de sus límites',
        'Suplantar a otra persona o entidad',
        'Infringir cualquier ley aplicable',
      ] },
      { p: 'Podemos eliminar contenido o restringir el acceso si se infringen estas reglas.' },
    ] },
    { title: 'Periodo beta', beta: true, blocks: [
      { p: 'El Servicio se encuentra actualmente en beta. Durante este periodo:' },
      { ul: [
        'Los planes de pago pueden estar disponibles sin costo mientras evaluamos la experiencia. Avisaremos a los usuarios con anticipación antes de que empiece la facturación.',
        'Algunas capacidades, como la generación de ilustraciones, pueden pausarse o limitarse para controlar costos. Durante esos periodos, los cuentos pueden entregarse solo con texto.',
        'Las funciones pueden agregarse, cambiarse o eliminarse sin previo aviso.',
      ] },
    ] },
    { title: 'Cambios en el Servicio', blocks: [
      { p: 'Podemos cambiar, suspender o descontinuar partes del Servicio en cualquier momento.' },
    ] },
    { title: 'Limitación de responsabilidad', blocks: [
      { p: 'En la máxima medida permitida por la ley, Nest & Quill y su operador no serán responsables de daños indirectos, incidentales o consecuentes derivados del uso del Servicio.' },
      { p: 'La responsabilidad total no excederá el monto que hayas pagado en los 12 meses anteriores a la reclamación.' },
    ] },
    { title: 'Cambios en estos términos', blocks: [
      { p: 'Podemos actualizar estos Términos. Cuando lo hagamos, publicaremos la nueva versión en esta página con una nueva fecha de “Última actualización”. Si sigues usando el Servicio después de una actualización, se aplican los Términos actualizados.' },
    ] },
    { title: 'Contacto', blocks: [{ contact: 'Si tienes preguntas sobre estos Términos, o alguna inquietud sobre el Servicio o un cargo, contáctanos primero para que podamos intentar resolverla:' }] },
  ],
}

// ── Privacy Policy ───────────────────────────────────────────────────────────

const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  updated: UPDATED_EN,
  operator: OPERATOR_EN,
  sections: [
    { title: 'Overview', blocks: [
      { p: 'This Privacy Policy explains what information Nest & Quill collects, how we use and share it, and the choices you have. Nest & Quill is operated by Digital Official & Huerta Group (“we”, “us”, “our”). This policy covers our website, story creation, accounts, emails and the chat assistant on our website.' },
      { p: 'Nest & Quill is intended for adults age 18 or older who create personalized books for children. Children are not meant to create accounts or use the Service on their own. Much of the information we handle is about a child, but it is provided by an adult.' },
    ] },
    { title: 'Beta Notice', beta: true, blocks: [
      { p: 'Nest & Quill is currently in beta. Some paid features may be free during this period and certain capabilities (such as illustration generation) may be paused or limited. We will give reasonable notice before enabling billing or removing beta accommodations.' },
    ] },
    { title: 'Information We Collect', blocks: [
      { strong: 'Account information' },
      { ul: [
        'Your email address and password. Passwords are managed by our authentication provider and are not stored in readable form.',
        'Account identifiers, account type and sign-in records kept by our authentication provider.',
        'Your Free-book usage and the plans, purchases and subscription periods available to your account.',
      ] },
      { strong: 'Guest information' },
      { ul: [
        'If you create a story without an account: the email address you enter, and a guest token stored in your browser and with the story so you can follow it and later add it to an account.',
      ] },
      { strong: 'Story personalization information' },
      { ul: [
        'The child’s name and age or age range.',
        'What you tell us about the child, such as personality, interests and appearance.',
        'Supporting characters you add, such as siblings, friends, relatives or pets, and their relationship to the child.',
        'Story choices such as theme, tone, setting, challenge, goal, lesson, character traits, illustration style and book length.',
        'Dedication, author or byline name, closing message and any extra notes you add.',
        'The language of the story and the adult authorization confirmation described below.',
      ] },
      { strong: 'Generated content' },
      { ul: [
        'The story text and title, page-by-page scene descriptions, the story plan, and the instructions (prompts) used to create the text and illustrations, together with the AI provider’s responses and technical usage information.',
        'Illustrations, and PDF versions of books where they are created.',
        'Each story’s status and delivery history.',
      ] },
      { strong: 'Purchase information (when paid plans are offered)' },
      { ul: [
        'Records of purchases and subscription periods (plan, amount, currency, dates and status) and identifiers from our payment processor, Stripe. You enter card details on Stripe’s checkout page; we do not receive or store your full card number.',
      ] },
      { strong: 'Support and contact information' },
      { ul: [
        'When you contact us: your name if you give it, your email address, subject, category, message and any later correspondence.',
      ] },
      { strong: 'Chat assistant' },
      { ul: [
        'Messages you type into the chat assistant are sent to our AI provider to produce a reply. We do not save chat conversations in our own database.',
      ] },
      { strong: 'Email and marketing preferences' },
      { ul: [
        'Records of the emails we send you (type, recipient and date) and of any request to stop marketing email.',
      ] },
      { strong: 'Operational and security information' },
      { ul: [
        'Processing, error, retry and delivery information for stories and emails.',
        'Rate-limit and abuse-prevention records. When a request is blocked by a rate limit, we may store a shortened one-way hash derived from the network (IP) address, not the address itself.',
        'Evidence of the adult authorization confirmation: whether it was given, when, and which version of the wording was shown.',
      ] },
      { p: 'We do not store your IP address, or a location derived from it, with your story records. Our hosting and infrastructure providers may process network addresses, device and browser information and request logs as needed to deliver and secure their own services (see “Service Providers” below).' },
    ] },
    { title: 'Children’s Information and Adult Authorization', blocks: [
      { p: 'We collect information about a child only from the adult creating the story. Before a story is submitted, that adult must confirm that they are an adult; that they are the child’s parent or legal guardian, or have permission from the child’s parent or legal guardian to provide the information; and that they have permission to provide information about any other people included in the story.' },
      { p: 'We store that this confirmation was given, when, and which version of the wording was shown. We do not verify the identity or age of the adult or their relationship to the child.' },
      { p: 'Story creation does not ask for photos, and we do not ask children to give us information directly. Please provide only what the story needs. If you believe a child gave us information directly, or that information was provided without the necessary permission, contact us.' },
    ] },
    { title: 'How We Use Information', blocks: [
      { p: 'We use information to:' },
      { ul: [
        'Create, illustrate, deliver and store your books',
        'Run accounts, guest stories and plan allowances',
        'Process purchases and subscriptions when paid plans are offered',
        'Send service emails and, unless you unsubscribe, marketing emails',
        'Answer support requests',
        'Prevent abuse, keep the Service secure and fix problems, which can include our team reviewing story records when needed for support, quality or safety',
        'Comply with legal obligations and handle disputes',
      ] },
      { p: 'We do not sell your personal information, and we do not use it for third-party advertising.' },
    ] },
    { title: 'AI Processing', blocks: [
      { p: 'We use OpenAI to write stories, create illustrations and run the chat assistant. For each task we send OpenAI the information needed for it. For a story, this can include the child’s name, age and description, supporting characters, story choices, dedication and notes you provide. For the chat assistant, it includes the messages you type. We do not include your email address in story-generation requests.' },
      { p: 'OpenAI processes this information to return results to us, under its own terms and policies. AI-generated content can contain errors or unexpected results, so please review every book before sharing it with a child.' },
    ] },
    { title: 'Story Links and Sharing', blocks: [
      { p: 'Each finished story has its own web address (a “story link”). Anyone who has the link can read the finished story without signing in and, where a PDF of the book has already been created, may also be able to download it. The link is not password-protected and should not be treated as a private vault.' },
      { ul: [
        'Our emails to you include your story link.',
        'Share the link only with people you want to see the story. Anyone you send it to can forward it to others.',
        'Archiving a story does not turn off its link. If a link has been shared more widely than you intended, contact us.',
      ] },
    ] },
    { title: 'Emails', blocks: [
      { p: 'Service emails are sent when needed to provide the Service: submission confirmations, story-ready and story-failed notices, welcome and account-confirmation emails, password resets, and billing-related messages when paid plans are offered. Unsubscribing from marketing does not stop service emails.' },
      { p: 'Marketing emails: after you create a story or an account, we may send a short series of emails with tips, story ideas and offers. Every marketing email includes an unsubscribe link. When you unsubscribe, we keep your email address on a suppression list so we can keep honoring your choice, including if you create another story later.' },
    ] },
    { title: 'Cookies and Browser Storage', blocks: [
      { p: 'We use only the cookies and browser storage needed to run the Service or to remember choices you make:' },
      { ul: [
        'Sign-in cookies from our authentication provider (Supabase) that keep you signed in.',
        'guest_token: a cookie that links a guest story to your browser for up to 90 days so you can follow it and add it to an account.',
        'nq_lang: a cookie and browser-storage entry that remembers your language.',
        'cookie_consent: browser storage that remembers your answer to the cookie notice.',
        'Your reading position in each story you read, stored in your browser.',
        'Your light or dark display preference, stored in your browser.',
        'Temporary storage in the current browser tab, such as your story answers while you complete checkout and whether you closed a guided tour.',
      ] },
      { p: 'We do not use advertising cookies, tracking pixels, tag managers, session-replay tools or third-party analytics. Some images, such as our logo, load from a content delivery network that receives standard request information.' },
      { p: 'Because everything listed above is needed for the Service or remembers a choice you made, choosing “Decline” on the cookie notice only records your choice; it does not turn this storage off. You can clear or block cookies and storage in your browser, but signing in, guest stories and saved preferences may then stop working.' },
    ] },
    { title: 'Service Providers', blocks: [
      { p: 'We use these providers to run the Service and share with each the information it needs to do its job for us:' },
      { ul: [
        'Vercel: hosts our website and application servers and runs scheduled tasks.',
        'Supabase: database, sign-in, file storage for illustrations and PDFs, and the backend that creates stories.',
        'OpenAI: AI story text, illustrations and the chat assistant.',
        'Resend: sends our service and marketing emails.',
        'Bunny CDN: delivers some website images, such as our logo.',
        'Cloudflare: domain name services and forwarding of email sent to our contact address.',
        'Google (Gmail): the mailbox where messages to our contact address are received and answered.',
        'Stripe: when paid plans are offered, processes payments and subscriptions and receives the payment details you enter, your email address and purchase details.',
      ] },
      { p: 'Each provider handles information under its own terms and policies. Infrastructure providers such as Vercel, Supabase, Bunny CDN and Cloudflare may keep their own request and security logs, which can include IP addresses and browser information. We may also disclose information when required by law or when needed to protect the rights, safety or security of our customers, the Service or others.' },
    ] },
    { title: 'Data Security', blocks: [
      { p: 'We use reasonable safeguards to protect information. Illustrations and PDFs are kept in private storage and delivered through time-limited links. However, no system is completely secure, and anyone who has a story link can read that story.' },
    ] },
    { title: 'Data Retention', blocks: [
      { p: 'We have not set fixed retention periods. We keep information for as long as it is needed to provide the Service and for related purposes, including:' },
      { ul: [
        'Account and story records while your account or story exists, including guest stories after the guest token in your browser expires',
        'Purchase and subscription records for accounting, tax and dispute purposes',
        'Marketing suppression records, so an unsubscribe keeps working',
        'Security, abuse-prevention and operational records',
        'Information we must keep to meet legal obligations',
      ] },
      { p: 'Copies of information may remain in backups and logs, and in the systems of our providers (including email, payment, AI and infrastructure providers) under their own retention practices. These copies cannot always be removed immediately.' },
    ] },
    { title: 'Archive and Deletion Requests', blocks: [
      { p: 'Archiving a story hides it from your library. It is not deletion: the story, its text, illustrations and any PDF remain stored, its link keeps working, and you can restore it.' },
      { p: 'There is currently no self-service way to permanently delete a story or an account. You can ask us to delete a story, your account or other personal information by writing to the contact address below. We will review the request and may need to confirm that it comes from the account holder or the person who created the story. Some information may be kept for the reasons described under “Data Retention”, and copies held in backups or by our providers may not be removable right away.' },
    ] },
    { title: 'Your Choices and Requests', blocks: [
      { p: 'You can:' },
      { ul: [
        'Unsubscribe from marketing email using the link in any marketing email',
        'Leave out optional story details such as dedications and notes',
        'Clear or block cookies and browser storage in your browser',
        'Contact us to ask about, correct or delete information we hold about you or a story you created',
      ] },
      { p: 'Depending on where you live, you may have additional privacy rights. Contact us to make a request.' },
    ] },
    { title: 'Changes to This Policy', blocks: [
      { p: 'We may update this policy. When we do, we will post the new version on this page with a new “Last updated” date.' },
    ] },
    { title: 'Contact', blocks: [{ contact: 'For privacy questions or requests, contact us at:' }] },
  ],
}

const privacyEs: LegalDoc = {
  title: 'Política de privacidad',
  updated: UPDATED_ES,
  operator: OPERATOR_ES,
  sections: [
    { title: 'Resumen', blocks: [
      { p: 'Esta Política de privacidad explica qué información recopila Nest & Quill, cómo la usamos y la compartimos, y qué opciones tienes. Nest & Quill es operado por Digital Official & Huerta Group (“nosotros”). Esta política cubre nuestro sitio web, la creación de cuentos, las cuentas, los correos electrónicos y el asistente de chat de nuestro sitio.' },
      { p: 'Nest & Quill está pensado para personas adultas de 18 años o más que crean libros personalizados para niños. Los niños no deben crear cuentas ni usar el Servicio por su cuenta. Gran parte de la información que tratamos es sobre un niño o una niña, pero la proporciona una persona adulta.' },
    ] },
    { title: 'Aviso de beta', beta: true, blocks: [
      { p: 'Nest & Quill se encuentra actualmente en beta. Algunas funciones de pago pueden ser gratuitas durante este periodo y ciertas capacidades (como la generación de ilustraciones) pueden pausarse o limitarse. Daremos un aviso razonable antes de activar la facturación o de retirar las condiciones especiales de la beta.' },
    ] },
    { title: 'Información que recopilamos', blocks: [
      { strong: 'Información de la cuenta' },
      { ul: [
        'Tu dirección de correo electrónico y tu contraseña. Las contraseñas las gestiona nuestro proveedor de autenticación y no se guardan en forma legible.',
        'Identificadores de la cuenta, tipo de cuenta y registros de inicio de sesión que conserva nuestro proveedor de autenticación.',
        'Tu uso de libros Free y los planes, compras y periodos de suscripción disponibles en tu cuenta.',
      ] },
      { strong: 'Información de invitado' },
      { ul: [
        'Si creas un cuento sin cuenta: la dirección de correo electrónico que indicas y un identificador de invitado guardado en tu navegador y junto al cuento para que puedas seguirlo y añadirlo después a una cuenta.',
      ] },
      { strong: 'Información para personalizar el cuento' },
      { ul: [
        'El nombre del niño o la niña y su edad o rango de edad.',
        'Lo que nos cuentas sobre el niño o la niña, como su personalidad, sus intereses y su apariencia.',
        'Los personajes secundarios que añadas, como hermanos, amigos, familiares o mascotas, y su relación con el niño o la niña.',
        'Opciones del cuento como el tema, el tono, el escenario, el desafío, la meta, la lección, los rasgos del personaje, el estilo de ilustración y la extensión del libro.',
        'La dedicatoria, el nombre del autor o de la firma, el mensaje final y cualquier nota adicional que añadas.',
        'El idioma del cuento y la confirmación de autorización adulta descrita más abajo.',
      ] },
      { strong: 'Contenido generado' },
      { ul: [
        'El texto y el título del cuento, las descripciones de escena de cada página, el plan del cuento y las instrucciones (prompts) usadas para crear el texto y las ilustraciones, junto con las respuestas del proveedor de IA y la información técnica de uso.',
        'Las ilustraciones y, cuando se crean, las versiones en PDF de los libros.',
        'El estado y el historial de entrega de cada cuento.',
      ] },
      { strong: 'Información de compras (cuando se ofrezcan planes de pago)' },
      { ul: [
        'Registros de compras y periodos de suscripción (plan, importe, moneda, fechas y estado) e identificadores de nuestro procesador de pagos, Stripe. Ingresas los datos de tu tarjeta en la página de pago de Stripe; no recibimos ni almacenamos el número completo de tu tarjeta.',
      ] },
      { strong: 'Información de soporte y contacto' },
      { ul: [
        'Cuando nos contactas: tu nombre si lo indicas, tu correo electrónico, el asunto, la categoría, el mensaje y cualquier correspondencia posterior.',
      ] },
      { strong: 'Asistente de chat' },
      { ul: [
        'Los mensajes que escribes en el asistente de chat se envían a nuestro proveedor de IA para generar una respuesta. No guardamos las conversaciones del chat en nuestra propia base de datos.',
      ] },
      { strong: 'Correo electrónico y preferencias de marketing' },
      { ul: [
        'Registros de los correos que te enviamos (tipo, destinatario y fecha) y de cualquier solicitud para dejar de recibir correos de marketing.',
      ] },
      { strong: 'Información operativa y de seguridad' },
      { ul: [
        'Información de procesamiento, errores, reintentos y entrega de cuentos y correos.',
        'Registros de límites de uso y prevención de abusos. Cuando un límite de uso bloquea una solicitud, podemos guardar un hash unidireccional abreviado derivado de la dirección de red (IP), no la dirección en sí.',
        'La constancia de la confirmación de autorización adulta: si se dio, cuándo y qué versión del texto se mostró.',
      ] },
      { p: 'No guardamos tu dirección IP, ni una ubicación derivada de ella, en los registros de tus cuentos. Nuestros proveedores de alojamiento e infraestructura pueden tratar direcciones de red, información del dispositivo y del navegador y registros de solicitudes en la medida necesaria para prestar y proteger sus propios servicios (consulta “Proveedores de servicios” más abajo).' },
    ] },
    { title: 'Información de niños y autorización adulta', blocks: [
      { p: 'Recopilamos información sobre un niño o una niña solo de la persona adulta que crea el cuento. Antes de enviar un cuento, esa persona debe confirmar que es adulta; que es el padre, la madre o el tutor legal del niño o la niña, o que tiene permiso de su padre, madre o tutor legal para proporcionar la información; y que tiene permiso para proporcionar información sobre cualquier otra persona incluida en el cuento.' },
      { p: 'Guardamos que se dio esta confirmación, cuándo y qué versión del texto se mostró. No verificamos la identidad ni la edad de la persona adulta, ni su relación con el niño o la niña.' },
      { p: 'La creación de cuentos no pide fotos, y no pedimos a los niños que nos den información directamente. Proporciona solo lo que el cuento necesita. Si crees que un niño o una niña nos dio información directamente, o que se proporcionó información sin el permiso necesario, contáctanos.' },
    ] },
    { title: 'Cómo usamos la información', blocks: [
      { p: 'Usamos la información para:' },
      { ul: [
        'Crear, ilustrar, entregar y almacenar tus libros',
        'Gestionar cuentas, cuentos de invitado y límites de los planes',
        'Procesar compras y suscripciones cuando se ofrezcan planes de pago',
        'Enviar correos del servicio y, salvo que te des de baja, correos de marketing',
        'Responder solicitudes de soporte',
        'Prevenir abusos, mantener la seguridad del Servicio y corregir problemas, lo que puede incluir que nuestro equipo revise registros de cuentos cuando sea necesario para soporte, calidad o seguridad',
        'Cumplir obligaciones legales y atender disputas',
      ] },
      { p: 'No vendemos tu información personal ni la usamos para publicidad de terceros.' },
    ] },
    { title: 'Procesamiento con IA', blocks: [
      { p: 'Usamos OpenAI para escribir cuentos, crear ilustraciones y hacer funcionar el asistente de chat. Para cada tarea enviamos a OpenAI la información necesaria. Para un cuento, puede incluir el nombre, la edad y la descripción del niño o la niña, los personajes secundarios, las opciones del cuento, la dedicatoria y las notas que proporciones. Para el asistente de chat, incluye los mensajes que escribes. No incluimos tu dirección de correo electrónico en las solicitudes de generación de cuentos.' },
      { p: 'OpenAI trata esta información para devolvernos resultados, conforme a sus propios términos y políticas. El contenido generado por IA puede contener errores o resultados inesperados, así que revisa cada libro antes de compartirlo con un niño o una niña.' },
    ] },
    { title: 'Enlaces de los cuentos y cómo compartirlos', blocks: [
      { p: 'Cada cuento terminado tiene su propia dirección web (un “enlace del cuento”). Cualquier persona que tenga el enlace puede leer el cuento terminado sin iniciar sesión y, si ya se creó un PDF del libro, también puede descargarlo. El enlace no está protegido con contraseña y no debe considerarse un espacio privado.' },
      { ul: [
        'Los correos que te enviamos incluyen el enlace de tu cuento.',
        'Comparte el enlace solo con las personas que quieras que vean el cuento. Cualquier persona a quien se lo envíes puede reenviarlo a otras.',
        'Archivar un cuento no desactiva su enlace. Si un enlace se compartió más de lo que querías, contáctanos.',
      ] },
    ] },
    { title: 'Correos electrónicos', blocks: [
      { p: 'Los correos del servicio se envían cuando son necesarios para prestar el Servicio: confirmaciones de envío, avisos de cuento listo y de cuento fallido, correos de bienvenida y de confirmación de cuenta, restablecimiento de contraseña y, cuando se ofrezcan planes de pago, mensajes relacionados con la facturación. Darte de baja del marketing no detiene los correos del servicio.' },
      { p: 'Correos de marketing: después de que creas un cuento o una cuenta, podemos enviarte una breve serie de correos con consejos, ideas para cuentos y ofertas. Cada correo de marketing incluye un enlace para darte de baja. Cuando te das de baja, conservamos tu dirección de correo electrónico en una lista de exclusión para seguir respetando tu decisión, incluso si más adelante creas otro cuento.' },
    ] },
    { title: 'Cookies y almacenamiento del navegador', blocks: [
      { p: 'Solo usamos las cookies y el almacenamiento del navegador necesarios para que funcione el Servicio o para recordar las opciones que eliges:' },
      { ul: [
        'Cookies de inicio de sesión de nuestro proveedor de autenticación (Supabase) que mantienen tu sesión iniciada.',
        'guest_token: una cookie que vincula un cuento de invitado a tu navegador hasta por 90 días para que puedas seguirlo y añadirlo a una cuenta.',
        'nq_lang: una cookie y una entrada de almacenamiento del navegador que recuerdan tu idioma.',
        'cookie_consent: almacenamiento del navegador que recuerda tu respuesta al aviso de cookies.',
        'Tu posición de lectura en cada cuento que lees, guardada en tu navegador.',
        'Tu preferencia de modo claro u oscuro, guardada en tu navegador.',
        'Almacenamiento temporal en la pestaña actual del navegador, como tus respuestas del cuento mientras completas el pago y si cerraste una visita guiada.',
      ] },
      { p: 'No usamos cookies publicitarias, píxeles de seguimiento, gestores de etiquetas, herramientas de grabación de sesiones ni analítica de terceros. Algunas imágenes, como nuestro logotipo, se cargan desde una red de entrega de contenido que recibe la información estándar de la solicitud.' },
      { p: 'Como todo lo anterior es necesario para el Servicio o recuerda una opción que elegiste, elegir “Rechazar” en el aviso de cookies solo registra tu elección; no desactiva este almacenamiento. Puedes borrar o bloquear las cookies y el almacenamiento en tu navegador, pero entonces el inicio de sesión, los cuentos de invitado y las preferencias guardadas pueden dejar de funcionar.' },
    ] },
    { title: 'Proveedores de servicios', blocks: [
      { p: 'Usamos estos proveedores para operar el Servicio y compartimos con cada uno la información que necesita para hacer su trabajo para nosotros:' },
      { ul: [
        'Vercel: aloja nuestro sitio web y los servidores de la aplicación, y ejecuta tareas programadas.',
        'Supabase: base de datos, inicio de sesión, almacenamiento de archivos para ilustraciones y PDF, y el sistema que crea los cuentos.',
        'OpenAI: texto de los cuentos, ilustraciones y asistente de chat con IA.',
        'Resend: envía nuestros correos del servicio y de marketing.',
        'Bunny CDN: entrega algunas imágenes del sitio web, como nuestro logotipo.',
        'Cloudflare: servicios de nombres de dominio y reenvío del correo enviado a nuestra dirección de contacto.',
        'Google (Gmail): el buzón donde se reciben y responden los mensajes enviados a nuestra dirección de contacto.',
        'Stripe: cuando se ofrezcan planes de pago, procesa pagos y suscripciones y recibe los datos de pago que ingresas, tu correo electrónico y los detalles de la compra.',
      ] },
      { p: 'Cada proveedor trata la información conforme a sus propios términos y políticas. Los proveedores de infraestructura como Vercel, Supabase, Bunny CDN y Cloudflare pueden conservar sus propios registros de solicitudes y de seguridad, que pueden incluir direcciones IP e información del navegador. También podemos divulgar información cuando la ley lo exija o cuando sea necesario para proteger los derechos, la seguridad o la protección de nuestros clientes, del Servicio o de otras personas.' },
    ] },
    { title: 'Seguridad de los datos', blocks: [
      { p: 'Aplicamos medidas razonables para proteger la información. Las ilustraciones y los PDF se guardan en almacenamiento privado y se entregan mediante enlaces de duración limitada. Sin embargo, ningún sistema es completamente seguro, y cualquier persona que tenga el enlace de un cuento puede leerlo.' },
    ] },
    { title: 'Conservación de los datos', blocks: [
      { p: 'No hemos fijado plazos de conservación. Conservamos la información mientras sea necesaria para prestar el Servicio y para fines relacionados, entre ellos:' },
      { ul: [
        'Los registros de cuentas y cuentos mientras exista tu cuenta o tu cuento, incluidos los cuentos de invitado después de que caduque el identificador de invitado de tu navegador',
        'Los registros de compras y suscripciones con fines contables, fiscales y de disputas',
        'Los registros de exclusión de marketing, para que una baja siga funcionando',
        'Los registros de seguridad, prevención de abusos y operación',
        'La información que debemos conservar para cumplir obligaciones legales',
      ] },
      { p: 'Pueden quedar copias de la información en copias de seguridad y registros, y en los sistemas de nuestros proveedores (incluidos los de correo, pagos, IA e infraestructura) conforme a sus propias prácticas de conservación. Esas copias no siempre pueden eliminarse de inmediato.' },
    ] },
    { title: 'Archivo y solicitudes de eliminación', blocks: [
      { p: 'Archivar un cuento lo oculta de tu biblioteca. No es eliminarlo: el cuento, su texto, sus ilustraciones y cualquier PDF siguen almacenados, su enlace sigue funcionando y puedes restaurarlo.' },
      { p: 'Actualmente no existe una forma de eliminar de manera permanente un cuento o una cuenta por tu cuenta. Puedes pedirnos que eliminemos un cuento, tu cuenta u otra información personal escribiendo a la dirección de contacto indicada abajo. Revisaremos la solicitud y es posible que necesitemos confirmar que proviene del titular de la cuenta o de la persona que creó el cuento. Parte de la información puede conservarse por los motivos descritos en “Conservación de los datos”, y las copias en respaldos o en poder de nuestros proveedores pueden no eliminarse de inmediato.' },
    ] },
    { title: 'Tus opciones y solicitudes', blocks: [
      { p: 'Puedes:' },
      { ul: [
        'Darte de baja del correo de marketing con el enlace incluido en cualquier correo de marketing',
        'Omitir detalles opcionales del cuento, como las dedicatorias y las notas',
        'Borrar o bloquear las cookies y el almacenamiento en tu navegador',
        'Contactarnos para consultar, corregir o eliminar información que tengamos sobre ti o sobre un cuento que creaste',
      ] },
      { p: 'Según el lugar donde vivas, es posible que tengas derechos de privacidad adicionales. Contáctanos para presentar una solicitud.' },
    ] },
    { title: 'Cambios en esta política', blocks: [
      { p: 'Podemos actualizar esta política. Cuando lo hagamos, publicaremos la nueva versión en esta página con una nueva fecha de “Última actualización”.' },
    ] },
    { title: 'Contacto', blocks: [{ contact: 'Para preguntas o solicitudes relacionadas con la privacidad, escríbenos a:' }] },
  ],
}

export const LEGAL_CONTACT = CONTACT
export const legal: Record<Lang, { terms: LegalDoc; privacy: LegalDoc }> = {
  en: { terms: termsEn, privacy: privacyEn },
  es: { terms: termsEs, privacy: privacyEs },
}
