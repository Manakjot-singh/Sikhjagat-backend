/* =====================================================================
   DATA.JS — every piece of "content" the site shows.
   To add a program/video/etc, just add another object to these arrays.
   To add a language, add another key to STRINGS and LANGUAGE_NAMES.
   ===================================================================== */

const FULLY_TRANSLATED = ["en", "pa", "hi", "es", "fr"];

const LANGUAGE_NAMES = {
  en: "English", pa: "ਪੰਜਾਬੀ (Punjabi)", hi: "हिन्दी (Hindi)", es: "Español", fr: "Français",
  de: "Deutsch", zh: "中文", ar: "العربية", pt: "Português", ru: "Русский", ur: "اردو (Urdu)",
  id: "Bahasa Indonesia", it: "Italiano", tr: "Türkçe", ja: "日本語", ko: "한국어", vi: "Tiếng Việt",
  nl: "Nederlands", pl: "Polski", bn: "বাংলা", ta: "தமிழ்", gu: "ગુજરાતી", fa: "فارسی"
  /* ... in a real site this list would keep going to 100+; the point here
     is that any code you add here appears in the language picker, and the
     UI automatically shows an "auto-translated" tag unless you also add a
     full entry for it in STRINGS below. */
};

const STRINGS = {
  en: { home:"Home", about:"About Us", programs:"Programs", services:"Services", resources:"Resources",
    library:"Library", live:"Live Classes", media:"Media", contact:"Contact", feedback:"Feedback",
    login:"Login / Register", admin:"Admin Dashboard", videos:"Videos", photos:"Photos", vlogs:"Vlogs",
    podcasts:"Podcasts", posts:"Posts", articles:"Articles", bookmarks:"Bookmarks", notifications:"Notifications",
    heroTitle:"Sikh Jagat", heroSub:"A living archive of Sikh wisdom, Kirtan, Gurbani learning and community — open to the whole Sangat, everywhere.",
    heroCta:"Explore Programs", heroCta2:"Watch Live", readMore:"Read more", watchNow:"Watch now",
    joinClass:"Join class", save:"Save", saved:"Saved", sendMsg:"Send message", yourName:"Your name",
    yourEmail:"Email address", yourMsg:"Message", submit:"Submit", welcomeBack:"Welcome back",
    noAccount:"Create an account", haveAccount:"Already have an account?", signIn:"Sign in", signUp:"Sign up",
    logOut:"Log out", chatWithUs:"Chat with Sikh Jagat AI", askAnything:"Ask about Gurbani, programs, timings, anything.",
    faq:"FAQ", privacy:"Privacy Policy", search:"Search", searchPlaceholder:"Search photos, library, videos…",
    noSearchResults:"No results for", searchHint:"Start typing to search photos, library, videos and more…",
    footerTag:"Sarbat da Bhala — wellbeing of all." },
  pa: { home:"ਘਰ", about:"ਸਾਡੇ ਬਾਰੇ", programs:"ਪ੍ਰੋਗਰਾਮ", services:"ਸੇਵਾਵਾਂ", resources:"ਸਰੋਤ",
    library:"ਲਾਇਬ੍ਰੇਰੀ", live:"ਲਾਈਵ ਕਲਾਸਾਂ", media:"ਮੀਡੀਆ", contact:"ਸੰਪਰਕ", feedback:"ਸੁਝਾਅ",
    login:"ਲੌਗਿਨ / ਰਜਿਸਟਰ", admin:"ਐਡਮਿਨ ਡੈਸ਼ਬੋਰਡ", videos:"ਵੀਡੀਓ", photos:"ਫੋਟੋਆਂ", vlogs:"ਵਲੌਗ",
    podcasts:"ਪੌਡਕਾਸਟ", posts:"ਪੋਸਟਾਂ", articles:"ਲੇਖ", bookmarks:"ਬੁੱਕਮਾਰਕ", notifications:"ਸੂਚਨਾਵਾਂ",
    heroTitle:"ਸਿੱਖ ਜਗਤ", heroSub:"ਸਿੱਖ ਗਿਆਨ, ਕੀਰਤਨ, ਗੁਰਬਾਣੀ ਸਿੱਖਿਆ ਅਤੇ ਸੰਗਤ ਦਾ ਜੀਵੰਤ ਭੰਡਾਰ।",
    heroCta:"ਪ੍ਰੋਗਰਾਮ ਵੇਖੋ", heroCta2:"ਲਾਈਵ ਵੇਖੋ", readMore:"ਹੋਰ ਪੜ੍ਹੋ", watchNow:"ਹੁਣੇ ਵੇਖੋ",
    joinClass:"ਕਲਾਸ ਜੁਆਇਨ ਕਰੋ", save:"ਸੰਭਾਲੋ", saved:"ਸੰਭਾਲਿਆ", sendMsg:"ਸੁਨੇਹਾ ਭੇਜੋ", yourName:"ਤੁਹਾਡਾ ਨਾਮ",
    yourEmail:"ਈਮੇਲ", yourMsg:"ਸੁਨੇਹਾ", submit:"ਭੇਜੋ", welcomeBack:"ਜੀ ਆਇਆਂ ਨੂੰ",
    noAccount:"ਖਾਤਾ ਬਣਾਓ", haveAccount:"ਪਹਿਲਾਂ ਤੋਂ ਖਾਤਾ ਹੈ?", signIn:"ਸਾਈਨ ਇਨ", signUp:"ਸਾਈਨ ਅੱਪ",
    logOut:"ਲੌਗ ਆਊਟ", chatWithUs:"ਸਿੱਖ ਜਗਤ AI ਨਾਲ ਗੱਲ ਕਰੋ", askAnything:"ਗੁਰਬਾਣੀ, ਪ੍ਰੋਗਰਾਮ ਬਾਰੇ ਪੁੱਛੋ।",
    faq:"ਸਵਾਲ-ਜਵਾਬ", privacy:"ਪਰਦੇਦਾਰੀ ਨੀਤੀ", search:"ਖੋਜ", searchPlaceholder:"ਫੋਟੋਆਂ, ਲਾਇਬ੍ਰੇਰੀ, ਵੀਡੀਓ ਖੋਜੋ…",
    noSearchResults:"ਲਈ ਕੋਈ ਨਤੀਜਾ ਨਹੀਂ", searchHint:"ਖੋਜ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਟਾਈਪ ਕਰੋ…",
    footerTag:"ਸਰਬੱਤ ਦਾ ਭਲਾ।" },
  hi: { home:"होम", about:"हमारे बारे में", programs:"कार्यक्रम", services:"सेवाएं", resources:"संसाधन",
    library:"पुस्तकालय", live:"लाइव कक्षाएं", media:"मीडिया", contact:"संपर्क", feedback:"प्रतिक्रिया",
    login:"लॉगिन / रजिस्टर", admin:"एडमिन डैशबोर्ड", videos:"वीडियो", photos:"तस्वीरें", vlogs:"व्लॉग",
    podcasts:"पॉडकास्ट", posts:"पोस्ट", articles:"लेख", bookmarks:"बुकमार्क", notifications:"सूचनाएं",
    heroTitle:"सिख जगत", heroSub:"सिख ज्ञान, कीर्तन, गुरबाणी शिक्षा और संगत का जीवंत संग्रह।",
    heroCta:"कार्यक्रम देखें", heroCta2:"लाइव देखें", readMore:"और पढ़ें", watchNow:"अभी देखें",
    joinClass:"कक्षा जुड़ें", save:"सहेजें", saved:"सहेजा गया", sendMsg:"संदेश भेजें", yourName:"आपका नाम",
    yourEmail:"ईमेल", yourMsg:"संदेश", submit:"जमा करें", welcomeBack:"वापसी पर स्वागत है",
    noAccount:"खाता बनाएं", haveAccount:"पहले से खाता है?", signIn:"साइन इन", signUp:"साइन अप",
    logOut:"लॉग आउट", chatWithUs:"सिख जगत AI से बात करें", askAnything:"गुरबाणी, कार्यक्रम के बारे में पूछें।",
    faq:"सामान्य प्रश्न", privacy:"गोपनीयता नीति", search:"खोजें", searchPlaceholder:"तस्वीरें, पुस्तकालय, वीडियो खोजें…",
    noSearchResults:"के लिए कोई परिणाम नहीं", searchHint:"खोजने के लिए टाइप करना शुरू करें…",
    footerTag:"सबका भला।" },
  es: { home:"Inicio", about:"Sobre nosotros", programs:"Programas", services:"Servicios", resources:"Recursos",
    library:"Biblioteca", live:"Clases en vivo", media:"Medios", contact:"Contacto", feedback:"Comentarios",
    login:"Acceder / Registrarse", admin:"Panel admin", videos:"Videos", photos:"Fotos", vlogs:"Vlogs",
    podcasts:"Podcasts", posts:"Publicaciones", articles:"Artículos", bookmarks:"Marcadores", notifications:"Notificaciones",
    heroTitle:"Sikh Jagat", heroSub:"Un archivo vivo de sabiduría sij, Kirtan y aprendizaje de Gurbani.",
    heroCta:"Explorar programas", heroCta2:"Ver en vivo", readMore:"Leer más", watchNow:"Ver ahora",
    joinClass:"Unirse a la clase", save:"Guardar", saved:"Guardado", sendMsg:"Enviar mensaje", yourName:"Tu nombre",
    yourEmail:"Correo electrónico", yourMsg:"Mensaje", submit:"Enviar", welcomeBack:"Bienvenido de nuevo",
    noAccount:"Crear una cuenta", haveAccount:"¿Ya tienes cuenta?", signIn:"Iniciar sesión", signUp:"Registrarse",
    logOut:"Cerrar sesión", chatWithUs:"Chatea con Sikh Jagat AI", askAnything:"Pregunta sobre Gurbani, programas.",
    faq:"Preguntas frecuentes", privacy:"Política de privacidad", search:"Buscar", searchPlaceholder:"Buscar fotos, biblioteca, videos…",
    noSearchResults:"Sin resultados para", searchHint:"Empieza a escribir para buscar…",
    footerTag:"El bienestar de todos." },
  fr: { home:"Accueil", about:"À propos", programs:"Programmes", services:"Services", resources:"Ressources",
    library:"Bibliothèque", live:"Cours en direct", media:"Médias", contact:"Contact", feedback:"Avis",
    login:"Connexion / Inscription", admin:"Tableau de bord", videos:"Vidéos", photos:"Photos", vlogs:"Vlogs",
    podcasts:"Podcasts", posts:"Publications", articles:"Articles", bookmarks:"Favoris", notifications:"Notifications",
    heroTitle:"Sikh Jagat", heroSub:"Une archive vivante de la sagesse sikhe, du Kirtan et du Gurbani.",
    heroCta:"Explorer les programmes", heroCta2:"Voir en direct", readMore:"Lire la suite", watchNow:"Regarder",
    joinClass:"Rejoindre le cours", save:"Enregistrer", saved:"Enregistré", sendMsg:"Envoyer", yourName:"Votre nom",
    yourEmail:"E-mail", yourMsg:"Message", submit:"Envoyer", welcomeBack:"Bon retour",
    noAccount:"Créer un compte", haveAccount:"Déjà un compte ?", signIn:"Se connecter", signUp:"S'inscrire",
    logOut:"Déconnexion", chatWithUs:"Discutez avec Sikh Jagat AI", askAnything:"Posez vos questions sur le Gurbani.",
    faq:"FAQ", privacy:"Politique de confidentialité", search:"Rechercher", searchPlaceholder:"Rechercher photos, bibliothèque, vidéos…",
    noSearchResults:"Aucun résultat pour", searchHint:"Commencez à taper pour rechercher…",
    footerTag:"Le bien-être de tous." },
};

const PROGRAMS = [
  { id:"p1", title:"Gurmat Lifestyle", age:"All ages", days:"Sat & Sun · 10–11:30 AM", desc:` 

To inspire individuals to understand the principles of Gurbani and apply them in everyday life.

What will you learn?
Fundamental principles of Gurmat
Importance of Naam, Seva, and Simran
Good character and humility
Living according to Gurmat within family and society`, icon:"📖" },
  { id:"p2", title:"Personality Development", age:"All ages", days:"Tue & Thu · 6–7:30 PM", desc:`

To develop self-confidence, discipline, and effective life skills.

What will you learn?
Methods to build self-confidence
Time management
Communication skills
Goal setting
Leadership qualities
Positive thinking`, icon:"🎙️" },
  { id:"p3", title:"Happy Family Life", age:"All ages", days:"Sun · 12–1 PM", desc:`

To strengthen love, trust, and understanding within family relationships.

What will you learn?
Effective communication
Peaceful conflict resolution
Parent-child relationships
Family responsibilities
Mutual respect`, icon:"🏅" },
  { id:"p4", title:"Youth Development", age:"All ages", days:"Seasonal · 5-day residential", desc:`
To prepare young people for life goals, responsibility, and wise decision-making.

What will you learn?
Career planning
Effective study habits
Time and digital balance
Awareness about staying away from addictions
Social responsibility`, icon:"👥" },
  { id:"p5", title:"Mental Health Awareness", age:"All ages", days:"Wed · 7–8 PM (online)", desc:`To promote accurate understanding of mental health and encourage self-care habits.

What will you learn?
Understanding stress
General awareness about anxiety and depression
Principles of mindfulness
Healthy emotional management
When and how to seek help

Note: This course is intended for education and awareness purposes only. It is not a substitute for medical or psychiatric treatment.`, icon:"❤️" },
  { id:"p6", title:"Parenting", age:"All ages", days:"Fri · 11 AM–1 PM", desc:`What will you learn?
Positive parenting
Balancing discipline and love
Developing good habits
Effective communication with children
Value-based education
Course Structure`, icon:"👥" },
];

const SERVICES = [
  { id:"s1", title:"Gurbani Reflections", desc:"Articles that explain the teachings and wisdom of Gurbani in a simple way and connect them with everyday life.", icon:"❤️" },
  { id:"s2", title:"Inspirational Articles", desc:"Content focused on positive thinking, discipline, success, time management, and values that help build a meaningful life.", icon:"🏅" },
  { id:"s3", title:"Family Guidance", desc:"Practical advice and resources to strengthen relationships between parents and children, spouses, and other family members.", icon:"🛡️" },
  { id:"s4", title:"Personal Development", desc:"Content designed to help individuals build self-confidence, communication skills, leadership qualities, positive habits, and essential life skills.", icon:"✨" },
  { id:"s5", title:"Mental Health Awareness", desc:"Balanced and educational information about stress, anxiety, depression, and other mental health topics. This content is intended for educational purposes and is not a substitute for professional medical or psychological advice. We encourage readers to seek support from qualified professionals whenever needed.", icon:"💬" },
  { id:"s6", title:"Courses and Workshops", desc:"Structured courses, study materials, notes, and learning resources on a variety of topics to support continuous personal and spiritual growth.", icon:"🛡️" },
];

const RESOURCES = [
  { id:"r1", title:"Nitnem Gutka (Roman + Gurmukhi)", type:"PDF", size:"3.2 MB" },
  { id:"r2", title:"Sukhmani Sahib with translation", type:"PDF", size:"5.1 MB" },
  { id:"r3", title:"Sikh Rehat Maryada (English)", type:"PDF", size:"1.8 MB" },
  { id:"r4", title:"Gurmukhi Alphabet Chart", type:"Image", size:"640 KB" },
  { id:"r5", title:"Kids' Sakhi Colouring Book", type:"PDF", size:"12 MB" },
  { id:"r6", title:"Guide to Visiting a Gurdwara", type:"PDF", size:"900 KB" },
];

const LIBRARY_ITEMS = [
  { id:"l1", title:"Sri Guru Granth Sahib Ji — Study Edition", author:"Compiled Edition", cat:"Scripture" },
  { id:"l2", title:"The Name of My Beloved", author:"Trans. Gopal Singh", cat:"Poetry" },
  { id:"l3", title:"Sikhism: A Very Short Introduction", author:"Eleanor Nesbitt", cat:"History" },
  { id:"l4", title:"Empire of the Sikhs", author:"Patwant Singh", cat:"History" },
  { id:"l5", title:"Ardas: Sikh Prayer", author:"Anne Murphy (ed.)", cat:"Liturgy" },
  { id:"l6", title:"Learning Gurmukhi in 30 Days", author:"Sangat Press", cat:"Language" },
  { id:"l7", title:"The Guru Granth Sahib: Canon, Meaning and Authority", author:"Pashaura Singh", cat:"Scholarship" },
  { id:"l8", title:"Sikh Cuisine: Recipes from the Langar Hall", author:"Community Kitchen", cat:"Culture" },
];

const LIVE_CLASSES = [
  { id:"c1", title:"Morning Nitnem & Katha", host:"Bhai Manpreet Singh", time:"Today · 5:30 AM", live:true, linkType:"youtube", link:"https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  { id:"c2", title:"Gurmukhi for Beginners", host:"Bibi Harleen Kaur", time:"Today · 6:00 PM", live:false, linkType:"external", link:"" },
  { id:"c3", title:"Kirtan Practice Circle", host:"Ragi Jatha", time:"Tomorrow · 7:00 PM", live:false, linkType:"external", link:"" },
  { id:"c4", title:"Sikh History Q&A", host:"Dr. Amardeep Singh", time:"Sat · 11:00 AM", live:false, linkType:"youtube", link:"" },
];

const VIDEOS = [
  { id:"v1", title:"Asa Di Var — Full Kirtan", views:"18.2K", dur:"46:12", cat:"Kirtan" },
  { id:"v2", title:"How to tie a Dastar — Step by step", views:"92.4K", dur:"9:40", cat:"Tutorial" },
  { id:"v3", title:"Life of Guru Nanak Dev Ji — Part 1", views:"54.1K", dur:"22:05", cat:"History" },
  { id:"v4", title:"Simple Langar Kadhi Pakora Recipe", views:"11.6K", dur:"14:30", cat:"Langar" },
  { id:"v5", title:"Gatka Basics for Beginners", views:"7.9K", dur:"18:22", cat:"Martial Arts" },
  { id:"v6", title:"Rehras Sahib — Evening Prayer", views:"33.0K", dur:"20:15", cat:"Kirtan" },
];

const PHOTOS = [
  { id:"ph1", title:"Vaisakhi Nagar Kirtan 2026", count:"84 photos" },
  { id:"ph2", title:"Langar Seva — Winter Drive", count:"46 photos" },
  { id:"ph3", title:"Youth Camp Highlights", count:"120 photos" },
  { id:"ph4", title:"Gurpurab Diwan Evening", count:"63 photos" },
  { id:"ph5", title:"New Gurdwara Foundation Laying", count:"38 photos" },
  { id:"ph6", title:"Kids' Sakhi Art Exhibition", count:"29 photos" },
];

const VLOGS = [
  { id:"vl1", title:"A Day in the Life of a Granthi", author:"Sikh Jagat Originals", dur:"12:04" },
  { id:"vl2", title:"Building Our First Community Garden", author:"Youth Wing", dur:"8:47" },
  { id:"vl3", title:"Behind the Scenes: Langar Kitchen", author:"Sikh Jagat Originals", dur:"15:20" },
  { id:"vl4", title:"My First Nagar Kirtan — Diaspora Story", author:"Guest Vlogger", dur:"10:12" },
];

const PODCASTS = [
  { id:"pd1", title:"Ep 24: Sikhi in the Diaspora", guest:"Panel discussion", dur:"52 min" },
  { id:"pd2", title:"Ep 23: Understanding the Mool Mantar", guest:"with Dr. Amardeep Singh", dur:"38 min" },
  { id:"pd3", title:"Ep 22: Raising Amritdhari Kids Abroad", guest:"with two Sikh parents", dur:"44 min" },
  { id:"pd4", title:"Ep 21: The Business of Seva", guest:"with community organizers", dur:"41 min" },
];

const ARTICLES = [
  { id:"a1", title:"Why Sarbat da Bhala matters more than ever", author:"Editorial Team", read:"6 min read" },
  { id:"a2", title:"A beginner's guide to the Five Ks", author:"Harleen Kaur", read:"8 min read" },
  { id:"a3", title:"Langar: the world's oldest community kitchen", author:"Manpreet Singh", read:"5 min read" },
  { id:"a4", title:"Teaching Gurmukhi to kids who don't speak Punjabi", author:"Sangat Press", read:"7 min read" },
  { id:"a5", title:"The architecture of the Golden Temple, explained", author:"Amardeep Singh", read:"9 min read" },
];

const DEFAULT_CMS = {
  heroTitle: "Sikh Jagat",
  heroSub: "A Step Towards Knowledge, Good Character, and a Fulfilling Life Through the Light of Gurmat. SikhJagat is a platform dedicated to presenting the teachings of Gurbani, Gurmat philosophy, personal development, family life, mental health awareness, and social values in a simple, practical, and easy-to-understand way. Our goal is not only to provide information but also to inspire people to lead a meaningful and virtuous life.",
  aboutText: "Welcome to SikhJagat. In today's fast-paced world, inner peace, strong character, and healthy family relationships are more important than ever. With this vision, SikhJagat was createdHere, you will find Gurbani-inspired life values, practical guidance, inspirational articles, educational courses, and content that encourages positive change in individuals and society—all in one place.",
  missionText: `To make the principles of Gurmat accessible through simple and easy-to-understand language.
     To inspire young people to develop good character, responsibility, and a spirit of selfless service (Seva).
     To provide guidance that strengthens love, respect, and understanding within families.
     To share accurate, balanced, and educational information about mental health awareness.
     To build a platform that promotes knowledge, learning, and a culture of service.`,
  contactAddress: "142 Sangat Road, Ludhiana, Punjab 141001, India",
  contactPhone: "+91 98140 00000",
  whatsappNumber: "+91 98140 00000",
  contactEmail: "sangat@sikhjagat.org",
  seoTitle: "Sikh Jagat — Sikh Learning, Kirtan & Community Platform",
  seoDesc: "Learn Gurbani, watch live Kirtan, explore Sikh history and connect with the global Sangat on Sikh Jagat.",
  seoKeywords: "Sikh, Sikhi, Gurbani, Kirtan, Gurdwara, Punjabi, Sangat, Nitnem, Guru Granth Sahib"
};