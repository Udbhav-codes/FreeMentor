/**
 * Every string the learner reads — product plan §5 ("Language: English ·
 * Hindi · Bilingual").
 *
 * English is the source of truth. `StringKey` is derived from it, and the
 * other two catalogues are typed `Record<StringKey, string>`, so adding an
 * English string and forgetting its translations is a compile error rather
 * than a word that silently stays English on a Hindi phone.
 *
 * ## The three languages are genuinely three
 *
 * `hi` is Devanagari. `hi-en` is Hinglish — Hindi written in Latin script,
 * which is how a very large number of Indian learners actually read and type,
 * and is not the same as "English with some Hindi words". Where a technical
 * term has no everyday Hindi equivalent, Hinglish keeps the English word
 * ("roadmap", "streak") because that is what a learner would say out loud.
 * Translating those into formal Devanagari would be more faithful to a
 * dictionary and less useful to a person.
 *
 * ## Interpolation
 *
 * `{name}` placeholders, filled by `t()`. Word order differs between English
 * and Hindi — Hindi is subject-object-verb — so a placeholder may sit in a
 * different position in each catalogue. That is exactly why the whole
 * sentence is translated rather than assembled from fragments.
 */

export const en = {
  // --- common ---
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',
  'common.skip': 'Skip',
  'common.notNow': 'Not now',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.minutes': '{count} min',
  'common.hours': '{count} h',

  // --- sign in ---
  'signIn.title': 'Welcome to FreeMentor',
  'signIn.body':
    'Sign in so your roadmap, your ticks and your streak are safe — and come back if you change phone.',
  'signIn.whatWeTake': 'WHAT WE TAKE FROM GOOGLE',
  'signIn.takeName': '· Your name and email',
  'signIn.takeNothingElse': '· Nothing else — no contacts, no files, no calendar',
  'signIn.button': 'Continue with Google',
  'signIn.opening': 'Opening Google…',
  'signIn.terms': 'By continuing you agree to our Terms and Privacy Policy.',
  'signIn.failed': 'Sign-in failed',

  // --- onboarding ---
  'onboarding.age.title': 'How old are you?',
  'onboarding.age.body': 'FreeMentor is for learners aged 16 and above.',
  'onboarding.age.birthYear': 'Which year were you born?',
  'onboarding.consent.title': 'A parent needs to agree',
  'onboarding.consent.body':
    'We send your parent or guardian a short code. Entering it is how they agree — until then we keep only your sign-in.',
  'onboarding.name.title': 'Tell us about you',
  'onboarding.name.body': 'Your name greets you each morning. A photo is optional.',
  'onboarding.name.placeholder': 'Your name',
  'onboarding.name.addPhoto': 'Add a photo',
  'onboarding.name.changePhoto': 'Change photo',
  'onboarding.name.removePhoto': 'Remove',
  'onboarding.name.photoOptional': 'Optional. Stays on your device.',
  'onboarding.language.title': 'Which language suits you?',
  'onboarding.notifications.title': 'Can we nudge you?',
  'onboarding.notifications.allow': 'Allow reminders',

  // --- home / roadmap ---
  'home.goodMorning': 'Good morning',
  'home.goodAfternoon': 'Good afternoon',
  'home.goodEvening': 'Good evening',
  'home.there': 'there',
  'home.yourGoal': 'YOUR GOAL',
  'home.weekOf': 'Week {week} of {total}',
  'home.topicsDone': '{done}/{total} topics',
  'home.projectedFinish': 'Projected finish: {date}',
  'home.yourRoute': 'Your route',
  'home.jumpToWeek': 'Jump to this week',
  'home.continueToday': "Continue today's task →",
  'home.reviewToday': 'Review today ✓',
  'home.restDay': 'Rest day — enjoy it',
  'home.nothingToday': 'Nothing scheduled today',
  'home.doneToGo': '{done} done · {toGo} to go',
  'home.allDone': "{done} done — all of today's plan",
  'home.streak': '{count}-day streak',
  'home.habit': 'habit {days}/{target}',
  'home.noRoadmap': 'No roadmap yet',
  'home.noRoadmapBody': 'Pick a goal and FreeMentor will build your day-by-day plan.',
  'home.chooseGoal': 'Choose your goal',

  // --- route / weeks ---
  'route.weekOf': 'Week of {date}',
  'route.locked': 'Locked',
  'route.unlocksOn': 'Unlocks {date}',
  'route.lockedWhy':
    'One week at a time, so the plan stays something you can act on rather than a wall of dates.',
  'route.today': 'Today',
  'route.restDay': 'Rest day',
  'route.mixedPractice': 'Mixed practice + weekly test',
  'route.lightRevision': 'Light revision',
  'route.finalRevision': 'Final revision',
  'route.study': 'Study',

  // --- day view ---
  'day.watch': 'Watch',
  'day.read': 'Read',
  'day.practice': 'Practice',
  'day.test': 'Test',
  'day.recallCheck': 'Recall check',
  'day.reveal': 'Show the answer',
  'day.enterScore': 'Enter your score',
  'day.howConfident': 'How confident do you feel?',
  'day.openLink': 'Open link',
  'day.premiumOnly': 'Premium',
  'day.watchAnAd': 'Watch an ad',
  'day.lockedAfterTrial': 'Locked',
  'day.linkBroken': 'link reported broken',

  // --- plans ---
  'plans.title': 'Keep your roadmap going',
  'plans.trialLeft': '{days} days left of your free trial',
  'plans.trialLastDay': 'Last day of your free trial',
  'plans.trialEnded': 'Your free trial has ended',
  'plans.whatLocks':
    'After that, notes, tests and practice links lock until you pick a plan — your roadmap and every YouTube lesson stay open.',
  'plans.whatLockedNow':
    '— your notes, tests and practice links are locked until you pick a plan. Your roadmap, your ticks and every YouTube lesson stay open.',
  'plans.couponLabel': 'Have a coupon?',
  'plans.couponApply': 'Apply',
  'plans.couponChecking': 'Checking…',
  'plans.couponApplied': '{code} · {percent}% off {plan}',
  'plans.youHave': 'You have {plan}',
  'plans.lifetime': 'Lifetime access to this roadmap. Nothing further to pay.',
  'plans.restore': 'Restore purchase',
  'plans.oneTime':
    'One-time payment for this roadmap, via Google Play. Lifetime access to the goal you chose.',

  // --- profile ---
  'profile.title': 'Profile',
  'profile.yourDetails': 'Your details',
  'profile.yourNumbers': 'Your numbers',
  'profile.hoursStudied': 'Hours studied',
  'profile.currentStreak': 'Current streak',
  'profile.bestStreak': 'Best streak',
  'profile.yourGoal': 'Your goal',
  'profile.changeGoal': 'Change goal',
  'profile.appearance': 'Appearance',
  'profile.notifications': 'Notifications',
  'profile.dailyReminder': 'Daily study reminder',
  'profile.weeklyReport': 'Weekly report',
  'profile.pickTimeBelow': 'Pick a time below',
  'profile.account': 'Account',
  'profile.signOut': 'Sign out',
  'profile.signedInAs': 'Signed in as {email}',
  'profile.syncNow': 'Sync now',
  'profile.resetRoadmap': 'Reset this roadmap',
  'profile.deleteAccount': 'Delete my account',
  'profile.about': 'About',
  'profile.aboutBody':
    'FreeMentor links to free, public resources. We never copy or re-host anyone’s content, and YouTube lessons are never put behind an ad or a paywall.',

  // --- progress ---
  'progress.title': 'Progress',
  'progress.thisWeek': 'This week',
  'progress.tasksDone': 'Tasks done',
  'progress.studyTime': 'Study time',
  'progress.noneYet': 'Nothing yet — tick your first task and it shows up here.',

  // --- choose a goal ---
  'choose.title': 'What do you want to learn?',
  'choose.searchPlaceholder': 'Search goals',
  'choose.comingSoon': 'Coming soon',
  'choose.noResults': 'No goals match that.',
} as const;

export type StringKey = keyof typeof en;

/**
 * Devanagari Hindi.
 *
 * Note the word order: Hindi is subject-object-verb, so a placeholder often
 * sits elsewhere in the sentence than it does in English. Translating whole
 * sentences rather than fragments is what makes that possible.
 */
export const hi: Record<StringKey, string> = {
  'common.continue': 'आगे बढ़ें',
  'common.back': 'पीछे',
  'common.cancel': 'रहने दें',
  'common.save': 'सेव करें',
  'common.done': 'हो गया',
  'common.skip': 'छोड़ें',
  'common.notNow': 'अभी नहीं',
  'common.loading': 'लोड हो रहा है…',
  'common.retry': 'फिर कोशिश करें',
  'common.minutes': '{count} मिनट',
  'common.hours': '{count} घंटे',

  'signIn.title': 'FreeMentor में आपका स्वागत है',
  'signIn.body':
    'साइन इन करें ताकि आपका रोडमैप, आपकी प्रगति और आपकी स्ट्रीक सुरक्षित रहे — और फ़ोन बदलने पर भी वापस मिल जाए।',
  'signIn.whatWeTake': 'गूगल से हम क्या लेते हैं',
  'signIn.takeName': '· आपका नाम और ईमेल',
  'signIn.takeNothingElse': '· और कुछ नहीं — न कॉन्टैक्ट, न फ़ाइलें, न कैलेंडर',
  'signIn.button': 'गूगल से जारी रखें',
  'signIn.opening': 'गूगल खुल रहा है…',
  'signIn.terms': 'आगे बढ़ने का मतलब है कि आप हमारी शर्तें और प्राइवेसी पॉलिसी मानते हैं।',
  'signIn.failed': 'साइन इन नहीं हो पाया',

  'onboarding.age.title': 'आपकी उम्र क्या है?',
  'onboarding.age.body': 'FreeMentor 16 साल और उससे बड़े विद्यार्थियों के लिए है।',
  'onboarding.age.birthYear': 'आपका जन्म किस साल हुआ?',
  'onboarding.consent.title': 'माता-पिता की अनुमति चाहिए',
  'onboarding.consent.body':
    'हम आपके माता-पिता या अभिभावक को एक छोटा कोड भेजेंगे। वह कोड डालना ही उनकी सहमति है — तब तक हम सिर्फ़ आपका साइन-इन रखते हैं।',
  'onboarding.name.title': 'अपने बारे में बताइए',
  'onboarding.name.body': 'हर सुबह आपका नाम आपका स्वागत करेगा। फ़ोटो देना ज़रूरी नहीं है।',
  'onboarding.name.placeholder': 'आपका नाम',
  'onboarding.name.addPhoto': 'फ़ोटो जोड़ें',
  'onboarding.name.changePhoto': 'फ़ोटो बदलें',
  'onboarding.name.removePhoto': 'हटाएँ',
  'onboarding.name.photoOptional': 'ज़रूरी नहीं। आपके फ़ोन में ही रहती है।',
  'onboarding.language.title': 'आपको कौन सी भाषा ठीक लगती है?',
  'onboarding.notifications.title': 'क्या हम याद दिला सकते हैं?',
  'onboarding.notifications.allow': 'रिमाइंडर चालू करें',

  'home.goodMorning': 'सुप्रभात',
  'home.goodAfternoon': 'नमस्कार',
  'home.goodEvening': 'शुभ संध्या',
  'home.there': 'दोस्त',
  'home.yourGoal': 'आपका लक्ष्य',
  'home.weekOf': '{total} में से हफ़्ता {week}',
  'home.topicsDone': '{total} में से {done} विषय',
  'home.projectedFinish': 'अनुमानित समाप्ति: {date}',
  'home.yourRoute': 'आपका रास्ता',
  'home.jumpToWeek': 'इस हफ़्ते पर जाएँ',
  'home.continueToday': 'आज का काम जारी रखें →',
  'home.reviewToday': 'आज का दोहराव ✓',
  'home.restDay': 'आराम का दिन — आनंद लें',
  'home.nothingToday': 'आज कुछ तय नहीं है',
  'home.doneToGo': '{done} हो गया · {toGo} बाकी',
  'home.allDone': '{done} हो गया — आज का पूरा प्लान',
  'home.streak': '{count} दिन की स्ट्रीक',
  'home.habit': 'आदत {days}/{target}',
  'home.noRoadmap': 'अभी कोई रोडमैप नहीं',
  'home.noRoadmapBody': 'एक लक्ष्य चुनिए और FreeMentor आपका दिन-ब-दिन का प्लान बना देगा।',
  'home.chooseGoal': 'अपना लक्ष्य चुनें',

  'route.weekOf': '{date} वाला हफ़्ता',
  'route.locked': 'बंद',
  'route.unlocksOn': '{date} को खुलेगा',
  'route.lockedWhy':
    'एक बार में एक हफ़्ता, ताकि प्लान तारीख़ों की दीवार नहीं बल्कि करने लायक चीज़ रहे।',
  'route.today': 'आज',
  'route.restDay': 'आराम का दिन',
  'route.mixedPractice': 'मिला-जुला अभ्यास + साप्ताहिक टेस्ट',
  'route.lightRevision': 'हल्का दोहराव',
  'route.finalRevision': 'आख़िरी दोहराव',
  'route.study': 'पढ़ाई',

  'day.watch': 'देखें',
  'day.read': 'पढ़ें',
  'day.practice': 'अभ्यास',
  'day.test': 'टेस्ट',
  'day.recallCheck': 'याददाश्त जाँच',
  'day.reveal': 'उत्तर दिखाएँ',
  'day.enterScore': 'अपना स्कोर डालें',
  'day.howConfident': 'आप कितना आश्वस्त महसूस करते हैं?',
  'day.openLink': 'लिंक खोलें',
  'day.premiumOnly': 'प्रीमियम',
  'day.watchAnAd': 'एक विज्ञापन देखें',
  'day.lockedAfterTrial': 'बंद',
  'day.linkBroken': 'लिंक टूटा बताया गया है',

  'plans.title': 'अपना रोडमैप जारी रखें',
  'plans.trialLeft': 'मुफ़्त ट्रायल के {days} दिन बाकी',
  'plans.trialLastDay': 'मुफ़्त ट्रायल का आख़िरी दिन',
  'plans.trialEnded': 'आपका मुफ़्त ट्रायल ख़त्म हो गया',
  'plans.whatLocks':
    'उसके बाद नोट्स, टेस्ट और अभ्यास के लिंक तब तक बंद रहेंगे जब तक आप कोई प्लान नहीं लेते — आपका रोडमैप और हर YouTube पाठ खुला रहेगा।',
  'plans.whatLockedNow':
    '— आपके नोट्स, टेस्ट और अभ्यास के लिंक तब तक बंद हैं जब तक आप कोई प्लान नहीं लेते। आपका रोडमैप, आपकी प्रगति और हर YouTube पाठ खुला है।',
  'plans.couponLabel': 'कोई कूपन है?',
  'plans.couponApply': 'लगाएँ',
  'plans.couponChecking': 'जाँच हो रही है…',
  'plans.couponApplied': '{code} · {plan} पर {percent}% छूट',
  'plans.youHave': 'आपके पास {plan} है',
  'plans.lifetime': 'इस रोडमैप पर आजीवन पहुँच। और कुछ नहीं देना है।',
  'plans.restore': 'ख़रीद वापस पाएँ',
  'plans.oneTime':
    'इस रोडमैप के लिए एक बार का भुगतान, Google Play से। आपने जो लक्ष्य चुना है उस पर आजीवन पहुँच।',

  'profile.title': 'प्रोफ़ाइल',
  'profile.yourDetails': 'आपकी जानकारी',
  'profile.yourNumbers': 'आपके आँकड़े',
  'profile.hoursStudied': 'पढ़ाई के घंटे',
  'profile.currentStreak': 'अभी की स्ट्रीक',
  'profile.bestStreak': 'सबसे अच्छी स्ट्रीक',
  'profile.yourGoal': 'आपका लक्ष्य',
  'profile.changeGoal': 'लक्ष्य बदलें',
  'profile.appearance': 'दिखावट',
  'profile.notifications': 'सूचनाएँ',
  'profile.dailyReminder': 'रोज़ पढ़ाई का रिमाइंडर',
  'profile.weeklyReport': 'साप्ताहिक रिपोर्ट',
  'profile.pickTimeBelow': 'नीचे समय चुनें',
  'profile.account': 'खाता',
  'profile.signOut': 'साइन आउट',
  'profile.signedInAs': '{email} से साइन इन',
  'profile.syncNow': 'अभी सिंक करें',
  'profile.resetRoadmap': 'यह रोडमैप रीसेट करें',
  'profile.deleteAccount': 'मेरा खाता मिटाएँ',
  'profile.about': 'के बारे में',
  'profile.aboutBody':
    'FreeMentor मुफ़्त, सार्वजनिक संसाधनों से जोड़ता है। हम किसी की सामग्री कॉपी या री-होस्ट नहीं करते, और YouTube पाठ कभी विज्ञापन या पेवॉल के पीछे नहीं रखे जाते।',

  'progress.title': 'प्रगति',
  'progress.thisWeek': 'इस हफ़्ते',
  'progress.tasksDone': 'पूरे किए काम',
  'progress.studyTime': 'पढ़ाई का समय',
  'progress.noneYet': 'अभी कुछ नहीं — पहला काम पूरा कीजिए, यहाँ दिखने लगेगा।',

  'choose.title': 'आप क्या सीखना चाहते हैं?',
  'choose.searchPlaceholder': 'लक्ष्य खोजें',
  'choose.comingSoon': 'जल्द आ रहा है',
  'choose.noResults': 'उससे कोई लक्ष्य नहीं मिला।',
};

/**
 * Hinglish — Hindi in Latin script.
 *
 * Not "English with Hindi words". This is how a great many Indian learners
 * read and type, and it keeps the English technical terms a person would
 * actually say out loud: roadmap, streak, practice, score. Rendering those as
 * formal Devanagari would be truer to a dictionary and less useful to a
 * learner. It also needs no Devanagari font.
 */
export const hinglish: Record<StringKey, string> = {
  'common.continue': 'Aage badhein',
  'common.back': 'Peeche',
  'common.cancel': 'Rehne dein',
  'common.save': 'Save karein',
  'common.done': 'Ho gaya',
  'common.skip': 'Chhodein',
  'common.notNow': 'Abhi nahin',
  'common.loading': 'Load ho raha hai…',
  'common.retry': 'Phir se try karein',
  'common.minutes': '{count} min',
  'common.hours': '{count} ghante',

  'signIn.title': 'FreeMentor mein aapka swagat hai',
  'signIn.body':
    'Sign in karein taaki aapka roadmap, progress aur streak safe rahe — aur phone badalne par bhi wapas mile.',
  'signIn.whatWeTake': 'GOOGLE SE HUM KYA LETE HAIN',
  'signIn.takeName': '· Aapka naam aur email',
  'signIn.takeNothingElse': '· Aur kuch nahin — na contacts, na files, na calendar',
  'signIn.button': 'Google se continue karein',
  'signIn.opening': 'Google khul raha hai…',
  'signIn.terms': 'Aage badhne ka matlab hai ki aap hamari Terms aur Privacy Policy maante hain.',
  'signIn.failed': 'Sign-in nahin ho paaya',

  'onboarding.age.title': 'Aapki umar kitni hai?',
  'onboarding.age.body': 'FreeMentor 16 saal aur usse bade learners ke liye hai.',
  'onboarding.age.birthYear': 'Aapka janm kis saal hua?',
  'onboarding.consent.title': 'Parent ki permission chahiye',
  'onboarding.consent.body':
    'Hum aapke parent ya guardian ko ek chhota code bhejenge. Wo code daalna hi unki sehmati hai — tab tak hum sirf aapka sign-in rakhte hain.',
  'onboarding.name.title': 'Apne baare mein bataiye',
  'onboarding.name.body': 'Har subah aapka naam aapka swagat karega. Photo dena zaroori nahin.',
  'onboarding.name.placeholder': 'Aapka naam',
  'onboarding.name.addPhoto': 'Photo add karein',
  'onboarding.name.changePhoto': 'Photo badlein',
  'onboarding.name.removePhoto': 'Hatayein',
  'onboarding.name.photoOptional': 'Zaroori nahin. Aapke phone mein hi rehti hai.',
  'onboarding.language.title': 'Aapko kaun si bhasha theek lagti hai?',
  'onboarding.notifications.title': 'Kya hum yaad dila sakte hain?',
  'onboarding.notifications.allow': 'Reminders chalu karein',

  'home.goodMorning': 'Good morning',
  'home.goodAfternoon': 'Good afternoon',
  'home.goodEvening': 'Good evening',
  'home.there': 'dost',
  'home.yourGoal': 'AAPKA GOAL',
  'home.weekOf': '{total} mein se week {week}',
  'home.topicsDone': '{total} mein se {done} topics',
  'home.projectedFinish': 'Anumanit finish: {date}',
  'home.yourRoute': 'Aapka route',
  'home.jumpToWeek': 'Is week par jaayein',
  'home.continueToday': 'Aaj ka kaam continue karein →',
  'home.reviewToday': 'Aaj ka review ✓',
  'home.restDay': 'Rest day — enjoy karein',
  'home.nothingToday': 'Aaj kuch plan nahin hai',
  'home.doneToGo': '{done} ho gaya · {toGo} baaki',
  'home.allDone': '{done} ho gaya — aaj ka poora plan',
  'home.streak': '{count}-din ki streak',
  'home.habit': 'habit {days}/{target}',
  'home.noRoadmap': 'Abhi koi roadmap nahin',
  'home.noRoadmapBody': 'Ek goal chuniye aur FreeMentor aapka din-ba-din ka plan bana dega.',
  'home.chooseGoal': 'Apna goal chunein',

  'route.weekOf': '{date} wala week',
  'route.locked': 'Locked',
  'route.unlocksOn': '{date} ko khulega',
  'route.lockedWhy':
    'Ek baar mein ek week, taaki plan tareekhon ki deewar nahin balki karne laayak cheez rahe.',
  'route.today': 'Aaj',
  'route.restDay': 'Rest day',
  'route.mixedPractice': 'Mixed practice + weekly test',
  'route.lightRevision': 'Halka revision',
  'route.finalRevision': 'Final revision',
  'route.study': 'Padhai',

  'day.watch': 'Dekhein',
  'day.read': 'Padhein',
  'day.practice': 'Practice',
  'day.test': 'Test',
  'day.recallCheck': 'Recall check',
  'day.reveal': 'Answer dikhayein',
  'day.enterScore': 'Apna score daalein',
  'day.howConfident': 'Aap kitna confident feel karte hain?',
  'day.openLink': 'Link kholein',
  'day.premiumOnly': 'Premium',
  'day.watchAnAd': 'Ek ad dekhein',
  'day.lockedAfterTrial': 'Locked',
  'day.linkBroken': 'link toota bataya gaya hai',

  'plans.title': 'Apna roadmap jaari rakhein',
  'plans.trialLeft': 'Free trial ke {days} din baaki',
  'plans.trialLastDay': 'Free trial ka aakhri din',
  'plans.trialEnded': 'Aapka free trial khatam ho gaya',
  'plans.whatLocks':
    'Uske baad notes, tests aur practice links tab tak lock rahenge jab tak aap koi plan nahin lete — aapka roadmap aur har YouTube lesson khula rahega.',
  'plans.whatLockedNow':
    '— aapke notes, tests aur practice links tab tak lock hain jab tak aap koi plan nahin lete. Aapka roadmap, aapki progress aur har YouTube lesson khula hai.',
  'plans.couponLabel': 'Koi coupon hai?',
  'plans.couponApply': 'Apply karein',
  'plans.couponChecking': 'Check ho raha hai…',
  'plans.couponApplied': '{code} · {plan} par {percent}% off',
  'plans.youHave': 'Aapke paas {plan} hai',
  'plans.lifetime': 'Is roadmap par lifetime access. Aur kuch nahin dena hai.',
  'plans.restore': 'Purchase wapas paayein',
  'plans.oneTime':
    'Is roadmap ke liye ek baar ka payment, Google Play se. Aapne jo goal chuna hai us par lifetime access.',

  'profile.title': 'Profile',
  'profile.yourDetails': 'Aapki details',
  'profile.yourNumbers': 'Aapke numbers',
  'profile.hoursStudied': 'Padhai ke ghante',
  'profile.currentStreak': 'Abhi ki streak',
  'profile.bestStreak': 'Sabse achhi streak',
  'profile.yourGoal': 'Aapka goal',
  'profile.changeGoal': 'Goal badlein',
  'profile.appearance': 'Appearance',
  'profile.notifications': 'Notifications',
  'profile.dailyReminder': 'Roz padhai ka reminder',
  'profile.weeklyReport': 'Weekly report',
  'profile.pickTimeBelow': 'Neeche samay chunein',
  'profile.account': 'Account',
  'profile.signOut': 'Sign out',
  'profile.signedInAs': '{email} se sign in',
  'profile.syncNow': 'Abhi sync karein',
  'profile.resetRoadmap': 'Yeh roadmap reset karein',
  'profile.deleteAccount': 'Mera account delete karein',
  'profile.about': 'Ke baare mein',
  'profile.aboutBody':
    'FreeMentor free, public resources se jodta hai. Hum kisi ka content copy ya re-host nahin karte, aur YouTube lessons kabhi ad ya paywall ke peeche nahin rakhe jaate.',

  'progress.title': 'Progress',
  'progress.thisWeek': 'Is week',
  'progress.tasksDone': 'Poore kiye tasks',
  'progress.studyTime': 'Padhai ka samay',
  'progress.noneYet': 'Abhi kuch nahin — pehla task tick kijiye, yahan dikhne lagega.',

  'choose.title': 'Aap kya seekhna chahte hain?',
  'choose.searchPlaceholder': 'Goals khojein',
  'choose.comingSoon': 'Jald aa raha hai',
  'choose.noResults': 'Usse koi goal nahin mila.',
};

export const catalogues = { en, hi, 'hi-en': hinglish } as const;
export type Language = keyof typeof catalogues;
