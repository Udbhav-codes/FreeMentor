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
    'After that everything locks — videos, notes, practice and tests — until you pick a plan. One payment unlocks this roadmap for life.',
  'plans.whatLockedNow':
    '— everything is locked until you pick a plan. One payment unlocks this roadmap for life. Your progress is safe and waiting.',
  // The feature lists. These must match billing/entitlement.ts — Basic
  // reaches every resource through a rewarded ad, videos included.
  'plans.badgeMostComplete': 'Most complete',
  'plans.basicFeature1': 'Your full roadmap and daily plan',
  'plans.basicFeature2': 'Every resource — videos, notes, practice and tests',
  'plans.basicFeature3': 'Each one opens after a short rewarded ad',
  'plans.basicFeature4': 'Progress, streak and weekly report',
  'plans.premiumFeature1': 'Everything in Basic, plus:',
  'plans.premiumFeature2': 'No ads anywhere',
  'plans.premiumFeature3': 'Extra notes (OpenStax, Think Python)',
  'plans.premiumFeature4': 'Detailed analytics and advanced reports',
  'plans.premiumFeature5': 'Full adaptive recalculation',
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
    'FreeMentor links to free, public resources. We never copy or re-host anyone’s content — every link opens at its original source, where it stays free to find.',

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

  // --- progress ---
  'progress.none': 'No progress yet',
  'progress.noneBody': 'Pick a goal to start tracking.',
  'progress.syllabusFinished': 'Syllabus finished',
  'progress.readyBy': 'Ready by',
  'progress.reserved': 'Mocks & revision reserved',
  'progress.badges': 'Badges',
  'progress.badgesNote':
    'Earned for work finished and hours studied — never for videos watched.',

  // --- reports ---
  'reports.title': 'Reports',
  'reports.none': 'No reports yet',
  'reports.noneBody': 'Pick a goal and your weekly report starts here.',
  'reports.studyTime': 'Study time',
  'reports.tasksDone': 'Tasks done',
  'reports.detailed': 'Detailed analytics',
  'reports.detailedBody':
    'Per-subject scores, weak-topic analysis and consistency trends. The weekly summary above is included in every plan.',
  'reports.seePlans': 'See plans',
  'reports.catchUp': 'Anything under 60% triggers a catch-up block before new content.',
  'reports.noScores': 'Enter your score after a test and it shows up here.',

  // --- practice ---
  'practice.title': 'Practice',
  'practice.none': 'No practice yet',
  'practice.noneBody': 'Pick a goal to get practice and past papers.',
  'practice.today': 'Today’s practice',
  'practice.openToday': 'Open today’s plan →',
  'practice.nothingToday': 'No practice scheduled today. Anything below is yours to dip into.',
  'practice.sourceNote':
    'Every link opens the original free source. FreeMentor never copies or re-hosts anyone’s content.',

  // --- choose a goal ---
  'choose.searchLong': 'Search exams, skills and languages',
  'choose.nothingMatched': 'Nothing matched that. Try a shorter word.',

  // --- day view ---
  'day.nothingScheduled': 'Nothing scheduled',
  'day.notInPlan': 'This day is not part of your plan.',
  'day.restDayTitle': 'Rest day',
  'day.restDayBody': 'Your streak is protected. See you tomorrow.',
  'day.cancelRestDay': 'Cancel rest day',
  'day.needRestDay': 'I need a rest day',
  'day.answerFromMemory': 'Answer from memory, then reveal',
  'day.score': 'Score',
  'day.outOf': 'Out of',

  // --- profile, the rest ---
  'profile.born': 'Born',
  'profile.exportProgress': 'Export my progress',
  'profile.seePlans': 'See plans',
  'profile.remindersExpoGo':
    'Reminders don’t fire in Expo Go — they work in the installed app.',
  'profile.resourcesNote':
    'Every video we link to is free on YouTube itself. What a plan pays for is the roadmap — which one to open, and when.',
  'profile.policies':
    'Privacy policy · Terms · Refund policy · Content policy — added before the store listing.',

  // --- dialogs a learner meets in normal use ---
  'dialog.resetTitle': 'Reset this roadmap?',
  'dialog.resetBody':
    'Your ticks, ratings and scores for this goal are cleared and the plan starts from today. This cannot be undone.',
  'dialog.reset': 'Reset',
  'dialog.deleteTitle': 'Delete your account?',
  'dialog.deleteBody':
    'Everything on this device is erased, and your account on the server is deleted within 30 days.',
  'dialog.deleteConfirm': 'Delete everything',
  'dialog.signOutTitle': 'Sign out?',
  'dialog.signOutBody': 'Your roadmap and progress stay on this phone. Sign back in to sync them.',
  'dialog.changeGoalTitle': 'Change your goal?',
  'dialog.changeGoalBody':
    'Your current roadmap is archived, not deleted \u2014 you can come back to it. A different goal is a separate purchase.',
  'dialog.changeGoalConfirm': 'Choose a new goal',
  'dialog.removePhotoTitle': 'Remove your photo?',
  'dialog.removePhotoBody': 'Your initials will show instead.',
  'dialog.remove': 'Remove',
  'dialog.photoPermissionTitle': 'Photo access is off',
  'dialog.photoPermissionBody':
    'FreeMentor needs permission to open your gallery. You can turn it on in Android settings \u2014 or skip it, the photo is optional.',
  'dialog.photoFailedTitle': 'Could not use that photo',
  'dialog.photoFailedBody': 'Try another image.',
  'dialog.restUnavailable': 'Rest day not available',
  'dialog.checkScoreTitle': 'Check your score',
  'dialog.checkScoreBody': 'Enter your score and the total it was out of.',
  'dialog.adGateTitle': 'Watch a short ad to open this?',
  'dialog.linkBrokenTitle': 'That link is reported broken',
  'dialog.linkBrokenBody': 'We are checking it. Try another resource for now.',

  // --- a few lines missed earlier ---
  'onboarding.welcome.body':
    'Let\u2019s build your roadmap with free, trusted resources. You tell us where you are and how much time you have.',
  'plans.youtubeAlways': 'Your roadmap and your progress stay visible. One payment unlocks every resource for life.',
  'plans.appliedAtCheckout': 'Applied at checkout. Google Play shows the final price before you pay.',
  'dialog.takeRestTitle': 'Take a rest day?',
  'dialog.takeRestBody': 'Your plan shifts forward and your streak is protected.',
  'dialog.linkFailedTitle': 'Could not open this link',
  'dialog.linkFailedBody': 'Check your connection and try again.',
  'trialOver.title': 'Your 3-day free trial is over',
  'trialOver.body':
    'One payment unlocks this roadmap — every video, note, practice and test — for life. No subscription.',
  'trialOver.cta': 'Unlock my roadmap',

  // --- data export and deletion (privacy policy §9; DPDP Act §§11-12) ---
  'export.working': 'Preparing your data…',
  'export.readyTitle': 'Your data is ready',
  'export.completeBody':
    'Everything we hold about you, including your account and purchase records. Save it wherever you like.',
  'export.deviceOnlyBody':
    'This covers everything on this phone — your roadmap, every task you ticked, your scores and your streak. Your purchase and consent records are held on our server and are not in this file.',
  'export.failedTitle': 'Could not export your data',
  'export.shareUnavailable':
    'This device has no way to share a file, so the export cannot be handed to you. Please contact support.',
  'dialog.deleteExportFirst':
    'Before you delete: an export is only possible while the account exists. If you want a copy of your data, cancel and tap Export my progress first.',
  'dialog.deleteServerFailedTitle': 'Your account was not deleted',
  'dialog.deleteServerFailedBody':
    'We could not reach the server, so your account still exists. Erasing this phone now would leave it in place. You can try again, or delete it from our website without the app.',
  'dialog.deleteWipeAnyway': 'Erase this phone anyway',
  'dialog.deleteScheduledTitle': 'Your account is being deleted',
  'dialog.deleteScheduledBody':
    'Everything on this phone is erased, and your account is removed from our server within {days} days. Payment records are kept as tax law requires.',
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
    'उसके बाद सब कुछ बंद हो जाएगा — वीडियो, नोट्स, अभ्यास और टेस्ट — जब तक आप कोई प्लान नहीं लेते। एक बार का भुगतान इस रोडमैप को आजीवन खोल देता है।',
  'plans.whatLockedNow':
    '— सब कुछ बंद है जब तक आप कोई प्लान नहीं लेते। एक बार का भुगतान इस रोडमैप को आजीवन खोल देता है। आपकी प्रगति सुरक्षित है।',
  'plans.badgeMostComplete': 'सबसे पूरा',
  'plans.basicFeature1': 'आपका पूरा रोडमैप और रोज़ की योजना',
  'plans.basicFeature2': 'हर संसाधन — वीडियो, नोट्स, अभ्यास और टेस्ट',
  'plans.basicFeature3': 'हर एक एक छोटे रिवॉर्डेड विज्ञापन के बाद खुलता है',
  'plans.basicFeature4': 'प्रगति, स्ट्रीक और साप्ताहिक रिपोर्ट',
  'plans.premiumFeature1': 'Basic का सब कुछ, और:',
  'plans.premiumFeature2': 'कहीं भी कोई विज्ञापन नहीं',
  'plans.premiumFeature3': 'अतिरिक्त नोट्स (OpenStax, Think Python)',
  'plans.premiumFeature4': 'विस्तृत विश्लेषण और उन्नत रिपोर्ट',
  'plans.premiumFeature5': 'पूरी अनुकूली पुनर्गणना',
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
    'FreeMentor मुफ़्त, सार्वजनिक संसाधनों से जोड़ता है। हम किसी की सामग्री कॉपी या री-होस्ट नहीं करते — हर लिंक अपने मूल स्रोत पर खुलता है, जहाँ वह मुफ़्त मिलती रहती है।',

  'progress.title': 'प्रगति',
  'progress.thisWeek': 'इस हफ़्ते',
  'progress.tasksDone': 'पूरे किए काम',
  'progress.studyTime': 'पढ़ाई का समय',
  'progress.noneYet': 'अभी कुछ नहीं — पहला काम पूरा कीजिए, यहाँ दिखने लगेगा।',

  'choose.title': 'आप क्या सीखना चाहते हैं?',
  'choose.searchPlaceholder': 'लक्ष्य खोजें',
  'choose.comingSoon': 'जल्द आ रहा है',
  'choose.noResults': 'उससे कोई लक्ष्य नहीं मिला।',

  'progress.none': 'अभी कोई प्रगति नहीं',
  'progress.noneBody': 'ट्रैकिंग शुरू करने के लिए एक लक्ष्य चुनें।',
  'progress.syllabusFinished': 'सिलेबस पूरा',
  'progress.readyBy': 'तैयारी पूरी',
  'progress.reserved': 'मॉक और दोहराव के लिए रखा',
  'progress.badges': 'बैज',
  'progress.badgesNote':
    'पूरे किए काम और पढ़ाई के घंटों पर मिलते हैं — कभी भी वीडियो देखने पर नहीं।',

  'reports.title': 'रिपोर्ट',
  'reports.none': 'अभी कोई रिपोर्ट नहीं',
  'reports.noneBody': 'एक लक्ष्य चुनिए और आपकी साप्ताहिक रिपोर्ट यहीं से शुरू होगी।',
  'reports.studyTime': 'पढ़ाई का समय',
  'reports.tasksDone': 'पूरे किए काम',
  'reports.detailed': 'विस्तृत विश्लेषण',
  'reports.detailedBody':
    'विषयवार स्कोर, कमज़ोर विषयों का विश्लेषण और निरंतरता के रुझान। ऊपर दी साप्ताहिक रिपोर्ट हर प्लान में शामिल है।',
  'reports.seePlans': 'प्लान देखें',
  'reports.catchUp': '60% से कम आने पर नई पढ़ाई से पहले एक कैच-अप ब्लॉक जुड़ जाता है।',
  'reports.noScores': 'टेस्ट के बाद अपना स्कोर डालिए, वह यहाँ दिखने लगेगा।',

  'practice.title': 'अभ्यास',
  'practice.none': 'अभी कोई अभ्यास नहीं',
  'practice.noneBody': 'अभ्यास और पुराने पेपर पाने के लिए एक लक्ष्य चुनें।',
  'practice.today': 'आज का अभ्यास',
  'practice.openToday': 'आज का प्लान खोलें →',
  'practice.nothingToday': 'आज कोई अभ्यास तय नहीं है। नीचे जो है वह आप कभी भी कर सकते हैं।',
  'practice.sourceNote':
    'हर लिंक मूल मुफ़्त स्रोत खोलता है। FreeMentor किसी की सामग्री कॉपी या री-होस्ट नहीं करता।',

  'choose.searchLong': 'परीक्षा, कौशल और भाषाएँ खोजें',
  'choose.nothingMatched': 'उससे कुछ नहीं मिला। छोटा शब्द आज़माएँ।',

  'day.nothingScheduled': 'कुछ तय नहीं है',
  'day.notInPlan': 'यह दिन आपके प्लान का हिस्सा नहीं है।',
  'day.restDayTitle': 'आराम का दिन',
  'day.restDayBody': 'आपकी स्ट्रीक सुरक्षित है। कल मिलते हैं।',
  'day.cancelRestDay': 'आराम का दिन रद्द करें',
  'day.needRestDay': 'मुझे आराम चाहिए',
  'day.answerFromMemory': 'याद से उत्तर दें, फिर देखें',
  'day.score': 'स्कोर',
  'day.outOf': 'में से',

  'profile.born': 'जन्म',
  'profile.exportProgress': 'मेरी प्रगति एक्सपोर्ट करें',
  'profile.seePlans': 'प्लान देखें',
  'profile.remindersExpoGo':
    'Expo Go में रिमाइंडर नहीं आते — इंस्टॉल किए ऐप में आते हैं।',
  'profile.resourcesNote':
    'हम जिस भी वीडियो से जोड़ते हैं वह YouTube पर मुफ़्त है। प्लान का भुगतान रोडमैप के लिए है — कौन सा खोलें, और कब।',
  'profile.policies':
    'प्राइवेसी पॉलिसी · शर्तें · रिफ़ंड पॉलिसी · कंटेंट पॉलिसी — स्टोर लिस्टिंग से पहले जोड़ी जाएँगी।',
  'dialog.resetTitle': 'यह रोडमैप रीसेट करें?',
  'dialog.resetBody':
    'इस लक्ष्य के आपके टिक, रेटिंग और स्कोर मिट जाएंगे और प्लान आज से शुरू होगा। यह वापस नहीं हो सकता।',
  'dialog.reset': 'रीसेट',
  'dialog.deleteTitle': 'अपना खाता मिटाएं?',
  'dialog.deleteBody':
    'इस फ़ोन का सब कुछ मिट जाएगा, और सर्वर पर आपका खाता 30 दिन में मिटा दिया जाएगा।',
  'dialog.deleteConfirm': 'सब कुछ मिटाएँ',
  'dialog.signOutTitle': 'साइन आउट करें?',
  'dialog.signOutBody': 'आपका रोडमैप और प्रगति इस फ़ोन में रहेंगे। सिंक के लिए फिर साइन इन करें।',
  'dialog.changeGoalTitle': 'अपना लक्ष्य बदलें?',
  'dialog.changeGoalBody':
    'आपका मौजूदा रोडमैप आर्काइव होगा, मिटेगा नहीं — आप उस पर लौट सकते हैं। दूसरा लक्ष्य एक अलग ख़रीद है।',
  'dialog.changeGoalConfirm': 'नया लक्ष्य चुनें',
  'dialog.removePhotoTitle': 'अपनी फ़ोटो हटाएं?',
  'dialog.removePhotoBody': 'उसकी जगह आपके आद्याक्षर दिखेंगे।',
  'dialog.remove': 'हटाएँ',
  'dialog.photoPermissionTitle': 'फ़ोटो की अनुमति बंद है',
  'dialog.photoPermissionBody':
    'FreeMentor को आपकी गैलरी खोलने की अनुमति चाहिए। आप इसे Android सेटिंग्स में चालू कर सकते हैं — या छोड़ दें, फ़ोटो ज़रूरी नहीं है।',
  'dialog.photoFailedTitle': 'वह फ़ोटो नहीं लग पाई',
  'dialog.photoFailedBody': 'कोई और तस्वीर आज़माएँ।',
  'dialog.restUnavailable': 'आराम का दिन उपलब्ध नहीं',
  'dialog.checkScoreTitle': 'अपना स्कोर जाँचें',
  'dialog.checkScoreBody': 'अपना स्कोर और कुल अंक दोनों डालें।',
  'dialog.adGateTitle': 'इसे खोलने के लिए एक छोटा विज्ञापन देखें?',
  'dialog.linkBrokenTitle': 'यह लिंक टूटा बताया गया है',
  'dialog.linkBrokenBody': 'हम जाँच रहे हैं। अभी कोई और संसाधन आज़माएँ।',

  'onboarding.welcome.body':
    'चलिए मुफ़्त, भरोसेमंद संसाधनों से आपका रोडमैप बनाते हैं। आप बस बताइए कि आप कहाँ हैं और कितना समय दे सकते हैं।',
  'plans.youtubeAlways': 'आपका रोडमैप और प्रगति दिखती रहती है। एक बार का भुगतान हर संसाधन को आजीवन खोल देता है।',
  'plans.appliedAtCheckout': 'चेकआउट पर लगेगा। भुगतान से पहले Google Play आख़िरी कीमत दिखाएगा।',

  'dialog.takeRestTitle': 'आज आराम करें?',
  'dialog.takeRestBody': 'आपका प्लान आगे खिसक जाएगा और स्ट्रीक सुरक्षित रहेगी।',
  'dialog.linkFailedTitle': 'यह लिंक नहीं खुल पाया',
  'dialog.linkFailedBody': 'अपना इंटरनेट जाँचकर फिर कोशिश करें।',
  'trialOver.title': 'आपका 3 दिन का मुफ़्त ट्रायल पूरा हुआ',
  'trialOver.body':
    'एक बार का भुगतान इस रोडमैप को — हर वीडियो, नोट, अभ्यास और टेस्ट — आजीवन खोल देता है। कोई सब्सक्रिप्शन नहीं।',
  'trialOver.cta': 'मेरा रोडमैप खोलें',

  'export.working': 'आपका डेटा तैयार किया जा रहा है…',
  'export.readyTitle': 'आपका डेटा तैयार है',
  'export.completeBody':
    'आपके बारे में हमारे पास जो कुछ है, आपके खाते और भुगतान रिकॉर्ड सहित। जहाँ चाहें सहेज लें।',
  'export.deviceOnlyBody':
    'इसमें इस फ़ोन का सब कुछ है — आपका रोडमैप, हर पूरा किया काम, आपके स्कोर और स्ट्रीक। आपके भुगतान और सहमति रिकॉर्ड हमारे सर्वर पर हैं और इस फ़ाइल में नहीं हैं।',
  'export.failedTitle': 'आपका डेटा निर्यात नहीं हो सका',
  'export.shareUnavailable':
    'इस डिवाइस में फ़ाइल साझा करने का कोई तरीका नहीं है, इसलिए निर्यात आपको नहीं दिया जा सकता। कृपया सहायता से संपर्क करें।',
  'dialog.deleteExportFirst':
    'हटाने से पहले: निर्यात तभी संभव है जब खाता मौजूद हो। अपने डेटा की प्रति चाहिए तो रद्द करें और पहले “मेरी प्रगति निर्यात करें” दबाएँ।',
  'dialog.deleteServerFailedTitle': 'आपका खाता हटाया नहीं गया',
  'dialog.deleteServerFailedBody':
    'हम सर्वर तक नहीं पहुँच सके, इसलिए आपका खाता अभी भी मौजूद है। अब इस फ़ोन को मिटाने से वह खाता बना रहेगा। आप फिर कोशिश कर सकते हैं, या ऐप के बिना हमारी वेबसाइट से इसे हटा सकते हैं।',
  'dialog.deleteWipeAnyway': 'फिर भी यह फ़ोन मिटाएँ',
  'dialog.deleteScheduledTitle': 'आपका खाता हटाया जा रहा है',
  'dialog.deleteScheduledBody':
    'इस फ़ोन का सब कुछ मिटा दिया गया है, और आपका खाता {days} दिनों में हमारे सर्वर से हट जाएगा। कर कानून के अनुसार भुगतान रिकॉर्ड रखे जाते हैं।',
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
    'Uske baad sab kuch lock ho jaayega — videos, notes, practice aur tests — jab tak aap koi plan nahin lete. Ek baar ka payment is roadmap ko lifetime khol deta hai.',
  'plans.whatLockedNow':
    '— sab kuch lock hai jab tak aap koi plan nahin lete. Ek baar ka payment is roadmap ko lifetime khol deta hai. Aapki progress safe hai.',
  'plans.badgeMostComplete': 'Sabse poora',
  'plans.basicFeature1': 'Aapka poora roadmap aur roz ka plan',
  'plans.basicFeature2': 'Har resource — videos, notes, practice aur tests',
  'plans.basicFeature3': 'Har ek chhote rewarded ad ke baad khulta hai',
  'plans.basicFeature4': 'Progress, streak aur weekly report',
  'plans.premiumFeature1': 'Basic ka sab kuch, aur:',
  'plans.premiumFeature2': 'Kahin bhi koi ad nahin',
  'plans.premiumFeature3': 'Extra notes (OpenStax, Think Python)',
  'plans.premiumFeature4': 'Detailed analytics aur advanced reports',
  'plans.premiumFeature5': 'Poori adaptive recalculation',
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
    'FreeMentor free, public resources se jodta hai. Hum kisi ka content copy ya re-host nahin karte — har link apne mool source par khulta hai, jahan woh free milti rehti hai.',

  'progress.title': 'Progress',
  'progress.thisWeek': 'Is week',
  'progress.tasksDone': 'Poore kiye tasks',
  'progress.studyTime': 'Padhai ka samay',
  'progress.noneYet': 'Abhi kuch nahin — pehla task tick kijiye, yahan dikhne lagega.',

  'choose.title': 'Aap kya seekhna chahte hain?',
  'choose.searchPlaceholder': 'Goals khojein',
  'choose.comingSoon': 'Jald aa raha hai',
  'choose.noResults': 'Usse koi goal nahin mila.',

  'progress.none': 'Abhi koi progress nahin',
  'progress.noneBody': 'Tracking shuru karne ke liye ek goal chunein.',
  'progress.syllabusFinished': 'Syllabus poora',
  'progress.readyBy': 'Taiyaari poori',
  'progress.reserved': 'Mocks aur revision ke liye rakha',
  'progress.badges': 'Badges',
  'progress.badgesNote':
    'Poore kiye kaam aur padhai ke ghanton par milte hain — kabhi bhi videos dekhne par nahin.',

  'reports.title': 'Reports',
  'reports.none': 'Abhi koi report nahin',
  'reports.noneBody': 'Ek goal chuniye aur aapki weekly report yahin se shuru hogi.',
  'reports.studyTime': 'Padhai ka samay',
  'reports.tasksDone': 'Poore kiye tasks',
  'reports.detailed': 'Detailed analytics',
  'reports.detailedBody':
    'Subject-wise scores, weak-topic analysis aur consistency trends. Upar di weekly report har plan mein shaamil hai.',
  'reports.seePlans': 'Plans dekhein',
  'reports.catchUp': '60% se kam aane par nayi padhai se pehle ek catch-up block jud jaata hai.',
  'reports.noScores': 'Test ke baad apna score daaliye, wo yahan dikhne lagega.',

  'practice.title': 'Practice',
  'practice.none': 'Abhi koi practice nahin',
  'practice.noneBody': 'Practice aur purane papers paane ke liye ek goal chunein.',
  'practice.today': 'Aaj ki practice',
  'practice.openToday': 'Aaj ka plan kholein →',
  'practice.nothingToday':
    'Aaj koi practice plan mein nahin hai. Neeche jo hai wo aap kabhi bhi kar sakte hain.',
  'practice.sourceNote':
    'Har link mool free source kholta hai. FreeMentor kisi ka content copy ya re-host nahin karta.',

  'choose.searchLong': 'Exams, skills aur languages khojein',
  'choose.nothingMatched': 'Usse kuch nahin mila. Chhota shabd try karein.',

  'day.nothingScheduled': 'Kuch plan nahin hai',
  'day.notInPlan': 'Yeh din aapke plan ka hissa nahin hai.',
  'day.restDayTitle': 'Rest day',
  'day.restDayBody': 'Aapki streak safe hai. Kal milte hain.',
  'day.cancelRestDay': 'Rest day cancel karein',
  'day.needRestDay': 'Mujhe aaram chahiye',
  'day.answerFromMemory': 'Yaad se answer dein, phir dekhein',
  'day.score': 'Score',
  'day.outOf': 'Mein se',

  'profile.born': 'Janm',
  'profile.exportProgress': 'Meri progress export karein',
  'profile.seePlans': 'Plans dekhein',
  'profile.remindersExpoGo':
    'Expo Go mein reminders nahin aate — install kiye app mein aate hain.',
  'profile.resourcesNote':
    'Hum jis bhi video se jodte hain woh YouTube par free hai. Plan ka payment roadmap ke liye hai — kaun sa kholein, aur kab.',
  'profile.policies':
    'Privacy policy · Terms · Refund policy · Content policy — store listing se pehle jodi jaayengi.',
  'dialog.resetTitle': 'Yeh roadmap reset karein?',
  'dialog.resetBody':
    'Is goal ke aapke ticks, ratings aur scores mit jaayenge aur plan aaj se shuru hoga. Yeh wapas nahin ho sakta.',
  'dialog.reset': 'Reset',
  'dialog.deleteTitle': 'Apna account delete karein?',
  'dialog.deleteBody':
    'Is phone ka sab kuch mit jaayega, aur server par aapka account 30 din mein delete kar diya jaayega.',
  'dialog.deleteConfirm': 'Sab kuch mitayein',
  'dialog.signOutTitle': 'Sign out karein?',
  'dialog.signOutBody': 'Aapka roadmap aur progress is phone mein rahenge. Sync ke liye phir sign in karein.',
  'dialog.changeGoalTitle': 'Apna goal badlein?',
  'dialog.changeGoalBody':
    'Aapka maujooda roadmap archive hoga, mitega nahin — aap us par laut sakte hain. Doosra goal ek alag purchase hai.',
  'dialog.changeGoalConfirm': 'Naya goal chunein',
  'dialog.removePhotoTitle': 'Apni photo hatayein?',
  'dialog.removePhotoBody': 'Uski jagah aapke initials dikhenge.',
  'dialog.remove': 'Hatayein',
  'dialog.photoPermissionTitle': 'Photo ki permission band hai',
  'dialog.photoPermissionBody':
    'FreeMentor ko aapki gallery kholne ki permission chahiye. Aap ise Android settings mein chalu kar sakte hain — ya chhod dein, photo zaroori nahin hai.',
  'dialog.photoFailedTitle': 'Wo photo nahin lag paayi',
  'dialog.photoFailedBody': 'Koi aur tasveer try karein.',
  'dialog.restUnavailable': 'Rest day available nahin',
  'dialog.checkScoreTitle': 'Apna score jaanchein',
  'dialog.checkScoreBody': 'Apna score aur kul ank dono daalein.',
  'dialog.adGateTitle': 'Ise kholne ke liye ek chhota ad dekhein?',
  'dialog.linkBrokenTitle': 'Yeh link toota bataya gaya hai',
  'dialog.linkBrokenBody': 'Hum jaanch rahe hain. Abhi koi aur resource try karein.',

  'onboarding.welcome.body':
    'Chaliye free, bharosemand resources se aapka roadmap banate hain. Aap bas bataiye ki aap kahan hain aur kitna samay de sakte hain.',
  'plans.youtubeAlways': 'Aapka roadmap aur progress dikhti rehti hai. Ek baar ka payment har resource ko lifetime khol deta hai.',
  'plans.appliedAtCheckout': 'Checkout par lagega. Payment se pehle Google Play aakhri keemat dikhayega.',

  'dialog.takeRestTitle': 'Aaj aaram karein?',
  'dialog.takeRestBody': 'Aapka plan aage khisak jaayega aur streak safe rahegi.',
  'dialog.linkFailedTitle': 'Yeh link nahin khul paaya',
  'dialog.linkFailedBody': 'Apna internet jaanchkar phir koshish karein.',
  'trialOver.title': 'Aapka 3 din ka free trial poora hua',
  'trialOver.body':
    'Ek baar ka payment is roadmap ko — har video, note, practice aur test — lifetime khol deta hai. Koi subscription nahin.',
  'trialOver.cta': 'Mera roadmap kholein',

  'export.working': 'Aapka data taiyaar kiya ja raha hai…',
  'export.readyTitle': 'Aapka data taiyaar hai',
  'export.completeBody':
    'Aapke baare mein hamare paas jo kuch hai, aapke account aur payment records ke saath. Jahan chahein save kar lein.',
  'export.deviceOnlyBody':
    'Isme is phone ka sab kuch hai — aapka roadmap, har poora kiya kaam, aapke scores aur streak. Aapke payment aur consent records hamare server par hain aur is file mein nahin hain.',
  'export.failedTitle': 'Aapka data export nahin ho saka',
  'export.shareUnavailable':
    'Is device mein file share karne ka koi tareeka nahin hai, isliye export aapko nahin diya ja sakta. Kripya support se sampark karein.',
  'dialog.deleteExportFirst':
    'Hataane se pehle: export tabhi possible hai jab account maujood ho. Apne data ki copy chahiye to cancel karein aur pehle “Meri progress export karein” dabayein.',
  'dialog.deleteServerFailedTitle': 'Aapka account delete nahin hua',
  'dialog.deleteServerFailedBody':
    'Hum server tak nahin pahunch sake, isliye aapka account abhi bhi maujood hai. Ab is phone ko mitaane se woh account bana rahega. Aap phir koshish kar sakte hain, ya app ke bina hamari website se ise delete kar sakte hain.',
  'dialog.deleteWipeAnyway': 'Phir bhi yeh phone mitaayein',
  'dialog.deleteScheduledTitle': 'Aapka account delete kiya ja raha hai',
  'dialog.deleteScheduledBody':
    'Is phone ka sab kuch mita diya gaya hai, aur aapka account {days} dinon mein hamare server se hat jaayega. Tax law ke anusaar payment records rakhe jaate hain.',
};

export const catalogues = { en, hi, 'hi-en': hinglish } as const;
export type Language = keyof typeof catalogues;
