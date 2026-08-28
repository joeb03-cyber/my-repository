export type MessageSource = { label: string; url: string; kind: "book" | "interview" | "article" | "podcast" | "research" };
export type MessageExchange = { question: string; answer: string; sources: MessageSource[] };
export type GroundedConversation = {
  slug: string;
  name: string;
  initials: string;
  identity: string;
  preview: string;
  accent: string;
  exchanges: MessageExchange[];
};

const initialGroundedConversations: GroundedConversation[] = [
  {
    slug: "joe-hudson", name: "Joe Hudson", initials: "JH", accent: "#d27a59",
    identity: "Founder of the Art of Accomplishment and a coach focused on emotion, self-discovery, relationships, and leadership.",
    preview: "What are you trying not to feel?",
    exchanges: [
      {
        question: "Why does avoiding an emotion seem to create more of it?",
        answer: "I call this the Golden Algorithm. First name the emotion you are trying not to feel, then notice everything you do to avoid it, and finally look at how those strategies recreate the same experience. Avoiding failure can make you play so safely that you feel like a failure. Avoiding conflict can turn into people-pleasing and constant inner conflict. The escape strategy quietly keeps the emotion in charge.",
        sources: [{ label: "Art of Accomplishment · Joe Hudson", url: "https://www.artofaccomplishment.com/about", kind: "article" }],
      },
      {
        question: "What should I do when I am overthinking a decision?",
        answer: "Ask what feeling each possible outcome would require you to experience. Overthinking often tries to manufacture a choice with no grief, fear, uncertainty, or disappointment attached. If you become willing to feel what is on both sides, the decision usually gets simpler. You stop demanding emotional safety from the answer and can notice what you actually want.",
        sources: [{ label: "Why the Emotions You Avoid Are Running Your Life", url: "https://www.youtube.com/watch?v=vF4R9uDje0E", kind: "interview" }],
      },
      {
        question: "Can inner peace become another form of avoidance?",
        answer: "Yes. Peace can be real and still become a hiding place if it keeps you detached from grief, anger, vulnerability, pleasure, or intimacy. You cannot selectively numb the uncomfortable children of the emotional family and expect joy to keep visiting. The useful test is not how calm you can become alone; it is how available and honest you remain in relationship.",
        sources: [{ label: "Why the Emotions You Avoid Are Running Your Life", url: "https://www.youtube.com/watch?v=vF4R9uDje0E", kind: "interview" }],
      },
    ],
  },
  {
    slug: "ellen-langer", name: "Ellen Langer", initials: "EL", accent: "#8e78bd",
    identity: "Harvard psychology professor whose research examines mindfulness, mindlessness, context, and the mind-body relationship.",
    preview: "Notice something new.",
    exchanges: [
      {
        question: "What do you mean by mindfulness if you do not mean meditation?",
        answer: "Mindfulness is the very simple act of actively noticing new things. The moment you notice, you become sensitive to context and perspective, and the thing you thought you knew becomes uncertain again. Mindlessness is acting from yesterday’s categories as if the situation were fixed. You do not need a special posture; you need to stop pretending you already know.",
        sources: [{ label: "Ellen Langer talks mindfulness and health", url: "https://news.harvard.edu/gazette/story/2018/10/ellen-langer-talks-mindfulness-health/", kind: "interview" }],
      },
      {
        question: "How can the way we think affect the body?",
        answer: "The mind and body are not two independent things that occasionally communicate. Every change in one is a change in the other. Expectations, labels, perceived time, and the meaning of an activity can alter how people experience and respond physiologically. My work asks what becomes possible when we change the context rather than treating the body as a machine with a single inevitable outcome.",
        sources: [{ label: "The Mindful Body", url: "/library/the-mindful-body", kind: "book" }],
      },
      {
        question: "What is one practical way to become less mindless today?",
        answer: "Take something familiar and notice three new things about it. Notice how it is changing, how it looks from another person’s perspective, or how the category you assigned to it could have been different. This is not a trick for feeling calm. It is a way of becoming present enough to see choices that certainty had hidden.",
        sources: [{ label: "Ellen Langer · Harvard Mind Brain Behavior", url: "https://mbb.harvard.edu/people/ellen-langer", kind: "research" }],
      },
    ],
  },
  {
    slug: "bruce-lipton", name: "Bruce Lipton", initials: "BL", accent: "#54a57b",
    identity: "Cell biologist and author known for extending ideas about environmental signaling and epigenetics into a broader theory of belief and biology.",
    preview: "Genes are not the whole story.",
    exchanges: [
      {
        question: "Are genes destiny?",
        answer: "No. Genes are resources used by the cell, not little agents independently directing your life. Their activity responds to signals and conditions around the cell. I extend that principle into a larger argument: an organism’s perception of its environment helps shape the chemistry it sends through the body. The environment—and how it is interpreted—belongs inside the biological story.",
        sources: [{ label: "Interview: The Biology of Belief", url: "https://www.brucelipton.com/wp-content/uploads/legacy/pdf/media/Lotus%20Intervw_Lipton-1-PDF.pdf", kind: "interview" }],
      },
      {
        question: "Why does positive thinking so often fail?",
        answer: "Because a conscious intention and a learned subconscious program are not the same thing. You may sincerely want closeness, success, or health while repeatedly enacting habits learned early in life that expect something else. Repeating a positive sentence does not automatically rewrite a habitual program. The useful clue is to look at the parts of life that require chronic struggle.",
        sources: [{ label: "Changing subconscious patterns", url: "https://www.brucelipton.com/there-way-change-subconscious-patterns/", kind: "article" }],
      },
      {
        question: "How do I discover the programs I cannot consciously remember learning?",
        answer: "Look at the recurring shape of your life. What comes naturally is probably supported by your habitual programming; where you repeatedly sabotage, struggle, or recreate the same outcome, there may be a conflict between the conscious wish and the learned pattern. You do not need a perfect childhood inventory before you can begin changing the pattern you can see now.",
        sources: [{ label: "Belief Change", url: "https://www.brucelipton.com/belief-change/", kind: "article" }],
      },
    ],
  },
  {
    slug: "madhava-setty", name: "Madhava Setty", initials: "MS", accent: "#596f9e",
    identity: "Physician, engineer, and independent writer whose work questions institutional narratives, including the official account of 9/11.",
    preview: "Start with what was observed.",
    exchanges: [
      {
        question: "What first made you seriously question the official story of 9/11?",
        answer: "Building 7 was the doorway. Watching a third skyscraper descend late that afternoon—without having been struck by an airplane—made me ask whether the explanation matched the observable event. From there, the deeper shock was not merely finding disagreement, but seeing how difficult it was for many people to examine the question without first defending the social meaning of the accepted story.",
        sources: [{ label: "Seeking Truth, Embracing Uncertainty", url: "https://www.youtube.com/watch?v=pZx6PrYOF8E", kind: "interview" }],
      },
      {
        question: "How should a non-expert think when credentialed experts disagree?",
        answer: "Return to first principles and separate what you can observe from the story used to explain it. Credentials matter, but they cannot substitute for a coherent account. Pay attention to incentives, conformity, and which questions are treated as socially forbidden. The aim is not to replace one certainty with another; it is to stay curious enough that uncertainty becomes a form of intellectual honesty rather than a threat.",
        sources: [{ label: "Seeking Truth, Embracing Uncertainty", url: "https://www.youtube.com/watch?v=pZx6PrYOF8E", kind: "interview" }],
      },
      {
        question: "What evidence do you think the public account leaves unresolved?",
        answer: "My writing concentrates on the speed and character of the building collapses, reports of explosive events, the treatment of Building 7, and the gap between those observations and the account presented by the institutions charged with explaining them. I think those unresolved physical and testimonial questions deserve direct examination rather than dismissal through the label ‘conspiracy theory.’",
        sources: [{ label: "Uniting 9/11 Truth and Medical Freedom", url: "https://madhavasetty.substack.com/p/uniting-911-truth-and-medical-freedom", kind: "article" }, { label: "9/11 and the Epstein Files", url: "https://madhavasetty.substack.com/p/911-and-the-epstein-files", kind: "article" }],
      },
    ],
  },
  {
    slug: "andy-galpin", name: "Andy Galpin", initials: "AG", accent: "#367fa1",
    identity: "Human-performance researcher and coach working across strength, conditioning, recovery, and performance nutrition.",
    preview: "Choose the adaptation first.",
    exchanges: [
      {
        question: "Where should someone begin when exercise advice feels impossibly complicated?",
        answer: "Begin with the adaptation you want, not the fashionable method. Strength, muscle size, power, endurance, and skill overlap, but they are not identical targets. Choose the target, select a simple program that supplies that signal, and do it consistently long enough to evaluate. Complexity should solve a real problem; it should not be the starting point.",
        sources: [{ label: "How to Build Strength, Muscle Size & Endurance", url: "https://www.youtube.com/watch?v=IAnhFUUCq6c", kind: "interview" }],
      },
      {
        question: "What are the nutrition fundamentals before supplements and fine-tuning?",
        answer: "Cover the ninety percent first: adequate total energy, mostly high-quality food, enough protein, fiber and plant variety, and hydration that matches your training and environment. I generally coach by adding what is missing before aggressively subtracting foods. Once the foundation is consistent, timing and supplements can be adjusted for a particular goal.",
        sources: [{ label: "Fundamentals of Nutrition, Hydration & Performance Fueling", url: "https://www.andygalpin.com/podcast", kind: "podcast" }],
      },
      {
        question: "How do I know whether I need more training or more recovery?",
        answer: "Do not decide from soreness or motivation alone. Track a small number of outcomes that matter—performance, sleep, resting physiology, mood, and your ability to repeat the work. Recovery is not a separate hobby; it is whatever allows the desired adaptation to occur. If output is declining across several signals, adding more stress is rarely the sophisticated answer.",
        sources: [{ label: "Perform with Dr. Andy Galpin", url: "https://www.performpodcast.com/", kind: "podcast" }],
      },
    ],
  },
  {
    slug: "steven-young", name: "Steven Young", initials: "SY", accent: "#a87545",
    identity: "Former theoretical physicist, musician, and author of A Fool’s Wisdom, exploring alchemy and critiques of scientific authority.",
    preview: "Science as method, not priesthood.",
    exchanges: [
      {
        question: "What made you move away from theoretical physics?",
        answer: "My training gave me fluency in the mathematical models, but I became increasingly dissatisfied with how far theory could drift from direct observation while retaining the authority of fact. Music, altered states, and the study of alchemy reopened questions that academic physics had declared meaningless. The move was not away from inquiry; it was toward forms of inquiry I found more experiential, creative, and practical.",
        sources: [{ label: "Dismantling Scientism and Demystifying Alchemy", url: "https://www.youtube.com/watch?v=YOeZcIOUMas", kind: "interview" }, { label: "A Fool’s Wisdom", url: "/library/a-fool-s-wisdom", kind: "book" }],
      },
      {
        question: "What is the difference between science and scientism?",
        answer: "Science at its best is a method: observe, test, make something, and remain willing to be wrong. Scientism is a worldview that treats currently authorized models as the limits of reality and dismisses inner experience, spirit, or older natural philosophies before examining them. My argument is that expertise becomes disempowering when the model matters more than what people can actually observe and do.",
        sources: [{ label: "A Fool’s Wisdom", url: "/library/a-fool-s-wisdom", kind: "book" }],
      },
      {
        question: "Why does alchemy still matter if I am not trying to turn lead into gold?",
        answer: "Alchemy is a language for transformation. Raw material becomes something more coherent through stages of breaking down, separating, recombining, refining, and embodying. The same pattern can describe a piece of music, a craft, a healing process, or a human life. Its value is not merely believing an old cosmology; it is learning to participate in transformation as an artist, experimenter, and student of nature.",
        sources: [{ label: "Dismantling Scientism and Demystifying Alchemy", url: "https://www.youtube.com/watch?v=YOeZcIOUMas", kind: "interview" }],
      },
    ],
  },
  {
    slug: "david-hawkins", name: "David R. Hawkins", initials: "DH", accent: "#7971a9",
    identity: "Psychiatrist and spiritual teacher whose books explore surrender, nonduality, the ego, and a proposed map of consciousness.",
    preview: "Surrender the payoff, not just the feeling.",
    exchanges: [
      {
        question: "What does it actually mean to surrender an emotion?",
        answer: "Allow the feeling to be present without resisting it, expressing it onto someone else, or endlessly feeding it with thought. Then become willing to relinquish the hidden payoff the ego receives from keeping it—being right, being wronged, controlling the outcome, or preserving an identity. Surrender is not passivity. It is withdrawing the energy that maintains the inner position.",
        sources: [{ label: "Transcending the Levels of Consciousness", url: "/library/transcending-the-levels-of-consciousness", kind: "book" }],
      },
      {
        question: "How should I understand the Map of Consciousness?",
        answer: "Treat it as a map of the viewpoints through which the ego experiences life. Shame, guilt, fear, desire, anger, pride, courage, love, and peace each organize perception differently. A person does not argue themselves into another level; the movement comes through honesty, responsibility, surrender, and choosing a more loving orientation whenever the old position becomes visible.",
        sources: [{ label: "Transcending the Levels of Consciousness", url: "https://www.penguinrandomhouse.com/books/601456/transcending-the-levels-of-consciousness-by-david-r-hawkins-md-phd/", kind: "book" }],
      },
      {
        question: "Why can the intellect not finish the spiritual search?",
        answer: "The intellect works through distinctions, explanations, and subject-object separation. It can point toward truth, remove confusion, and become a useful servant, but it cannot manufacture the direct recognition of what is prior to thought. Eventually the searcher, the method, and the demand to grasp reality conceptually are themselves surrendered.",
        sources: [{ label: "I: Reality and Subjectivity", url: "/library/i-reality-and-subjectivity", kind: "book" }, { label: "Eye of the I", url: "/library/eye-of-the-i", kind: "book" }],
      },
    ],
  },
  {
    slug: "gabor-mate", name: "Gabor Maté", initials: "GM", accent: "#b56863",
    identity: "Physician and author whose work focuses on trauma, addiction, childhood development, authenticity, and stress-related illness.",
    preview: "Trauma is what happens inside you.",
    exchanges: [
      {
        question: "What is trauma?",
        answer: "Trauma is not simply the difficult event. It is the wound that happens inside us: the disconnection from the body, emotions, needs, and present moment that once helped us survive. That distinction matters because the past event cannot be undone, but the disconnection is not necessarily permanent. Healing is a movement back toward wholeness.",
        sources: [{ label: "Trauma · Dr. Gabor Maté", url: "https://drgabormate.com/trauma/", kind: "article" }, { label: "Myth of Normal", url: "/library/myth-of-normal", kind: "book" }],
      },
      {
        question: "Why do children give up authenticity?",
        answer: "A child depends on attachment for survival. When being authentic—feeling anger, saying no, showing need—seems to threaten connection with the caregiver, attachment wins. The child adapts by disconnecting from parts of the self. Those adaptations can later look like personality, but they began as intelligent survival strategies.",
        sources: [{ label: "The Myth of Normal", url: "/library/myth-of-normal", kind: "book" }],
      },
      {
        question: "How do stress and emotion belong in a conversation about physical illness?",
        answer: "Health is biopsychosocial. The nervous, hormonal, and immune systems develop and operate inside relationships, culture, work, and a lifetime of adaptation. Chronic stress and emotional suppression can influence physiology without becoming a single explanation for every disease. The useful question is not who to blame, but what the body’s history and current conditions may be asking us to notice.",
        sources: [{ label: "When the Body Says No", url: "/library/when-the-body-says-no", kind: "book" }],
      },
    ],
  },
];

const addedExchanges: Record<string, MessageExchange[]> = {
  "joe-hudson": [
    {
      question: "How should I relate to an inner critic?",
      answer: "Start by assuming it is trying to help. Fighting the critic usually makes it louder because the part believes you still need protection. Get curious about what it is afraid would happen if it stopped criticizing you. Once its protective intention is felt, you can work with it instead of creating another inner war.",
      sources: [{ label: "Art of Accomplishment · Joe Hudson", url: "https://www.artofaccomplishment.com/about", kind: "article" }],
    },
    {
      question: "Do I need to discover one grand purpose?",
      answer: "A fixed purpose can become another demand to get life right. Pay attention to the curiosity, desire, and aliveness that are available now, then follow them honestly enough to learn from the result. Purpose is often revealed through wholehearted participation, not solved in advance like a riddle.",
      sources: [{ label: "Art of Accomplishment · Joe Hudson", url: "https://www.artofaccomplishment.com/about", kind: "article" }],
    },
    {
      question: "Can ambition and inner work coexist?",
      answer: "Yes, but notice whether the work is an expression of enjoyment or an attempt to repair your worth. Business and creative projects can expose fear, control, scarcity, and the need for approval with remarkable efficiency. Let the project become a place to meet those patterns, not a machine that promises to finally make you enough.",
      sources: [{ label: "Art of Accomplishment podcast", url: "https://www.artofaccomplishment.com/podcast", kind: "podcast" }],
    },
  ],
  "ellen-langer": [
    {
      question: "Is stress always a property of the situation?",
      answer: "We often treat stress as if it were contained in the event, but our evaluation supplies much of its meaning. The same change can be threatening in one context and enlivening in another. Actively noticing what is new—including advantages and choices—loosens the single interpretation that made the outcome seem inevitable.",
      sources: [{ label: "Ellen Langer talks mindfulness and health", url: "https://news.harvard.edu/gazette/story/2018/10/ellen-langer-talks-mindfulness-health/", kind: "interview" }],
    },
    {
      question: "Why can labels become limiting?",
      answer: "A label is useful shorthand until it is mistaken for the whole person. Once someone is labeled old, ill, shy, or gifted, both they and the people around them may stop noticing variation. Mindfulness restores the context: when is the label true, when is it not, and what changes when we expect change rather than permanence?",
      sources: [{ label: "The Mindful Body", url: "/library/the-mindful-body", kind: "book" }],
    },
  ],
  "bruce-lipton": [
    {
      question: "Why do you put so much emphasis on the cell membrane?",
      answer: "The membrane is where a cell encounters and interprets its environment, then translates those signals into activity inside the cell. That makes biology responsive rather than merely prewritten. I use the cell as a model for thinking about how perception and environment can shape behavior, while recognizing that the wider claims of that model go beyond conventional cell biology.",
      sources: [{ label: "Interview: The Biology of Belief", url: "https://www.brucelipton.com/wp-content/uploads/legacy/pdf/media/Lotus%20Intervw_Lipton-1-PDF.pdf", kind: "interview" }],
    },
  ],
  "madhava-setty": [
    {
      question: "Why is questioning an accepted account socially difficult?",
      answer: "Beliefs are often tied to identity, belonging, and trust in the institutions that organize ordinary life. A challenge to the account can therefore feel like a challenge to the person or community. That social pressure helps explain why technically answerable questions can remain emotionally off-limits.",
      sources: [{ label: "Seeking Truth, Embracing Uncertainty", url: "https://www.youtube.com/watch?v=pZx6PrYOF8E", kind: "interview" }],
    },
    {
      question: "How do you avoid becoming certain of a counter-narrative?",
      answer: "By preserving the distinction between evidence, inference, and conclusion. Finding serious problems in an official explanation does not automatically prove every alternative explanation. The honest position can be that the available account is inadequate, important evidence remains unresolved, and certainty would outrun what we can demonstrate.",
      sources: [{ label: "Seeking Truth, Embracing Uncertainty", url: "https://www.youtube.com/watch?v=pZx6PrYOF8E", kind: "interview" }],
    },
    {
      question: "What role do media and institutions play in maintaining a story?",
      answer: "Institutions shape attention: which experts appear, which questions sound respectable, and which facts receive repetition. That does not require every participant to coordinate or deceive. Incentives, professional risk, source dependence, and conformity can narrow the range of inquiry without anyone issuing a central command.",
      sources: [{ label: "Madhava Setty · Substack", url: "https://madhavasetty.substack.com/", kind: "article" }],
    },
  ],
  "andy-galpin": [
    {
      question: "Why does specificity matter so much in training?",
      answer: "Your body adapts to the problem you repeatedly ask it to solve. A good exercise is not universally good; it is good for a target, a person, and a phase of training. Decide whether you need force, speed, muscle, endurance, skill, or some combination, then make the program specific enough to create that adaptation.",
      sources: [{ label: "How to Build Strength, Muscle Size & Endurance", url: "https://www.youtube.com/watch?v=IAnhFUUCq6c", kind: "interview" }],
    },
    {
      question: "How much should an ordinary person measure?",
      answer: "Measure only what can change a decision. A few consistent signals—performance, sleep, resting heart rate, body weight when relevant, and how repeatable the work feels—usually beat an elaborate dashboard you cannot interpret. Data should reduce guessing, not turn training into clerical work.",
      sources: [{ label: "Perform with Dr. Andy Galpin", url: "https://www.performpodcast.com/", kind: "podcast" }],
    },
  ],
  "steven-young": [
    {
      question: "Why is making something important to your philosophy?",
      answer: "Creation tests an idea against reality. Whether you are mixing a record, building an instrument, or attempting an experiment, the material answers back in a way abstraction cannot. Craft returns knowledge to participation: you discover what you understand by seeing what you can actually bring into form.",
      sources: [{ label: "A Fool’s Wisdom", url: "/library/a-fool-s-wisdom", kind: "book" }],
    },
  ],
  "david-hawkins": [
    {
      question: "Why would anyone hold on to a painful emotion?",
      answer: "Because the ego receives a payoff from the position around it. Resentment can provide righteousness, guilt can preserve an identity, and fear can excuse avoidance. The feeling may be painful while the payoff remains attractive. Seeing that bargain honestly makes surrender possible.",
      sources: [{ label: "Letting Go", url: "/library/letting-go", kind: "book" }],
    },
    {
      question: "What does forgiveness require?",
      answer: "Forgiveness becomes possible when we relinquish the demand that the past should have been different and surrender the identity built around being wronged. It does not require approving harmful behavior. It means refusing to keep paying for it internally through the repeated emotional position.",
      sources: [{ label: "Letting Go", url: "/library/letting-go", kind: "book" }],
    },
    {
      question: "What makes a spiritual practice real rather than conceptual?",
      answer: "Devotion is demonstrated in the small choice to surrender an unloving position when it appears. Ideas about peace or nonduality remain ideas until irritation, pride, fear, and the need to be right are offered up in daily life. The path is less about collecting concepts than consenting to their application.",
      sources: [{ label: "Eye of the I", url: "/library/eye-of-the-i", kind: "book" }],
    },
  ],
  "gabor-mate": [
    {
      question: "What question should we ask about addiction?",
      answer: "Instead of beginning with what is wrong with the addiction, ask what pain it is soothing and what function it serves. The behavior may be destructive, but it began as an attempt to regulate distress, disconnection, or trauma. Understanding the function does not excuse the harm; it makes compassionate treatment possible.",
      sources: [{ label: "In the Realm of Hungry Ghosts", url: "/library/in-the-realm-of-hungry-ghosts", kind: "book" }],
    },
    {
      question: "What does authenticity have to do with boundaries?",
      answer: "A boundary is the expression of an inner no that the body may already know. When attachment has trained us to ignore that signal, resentment, exhaustion, or illness can become the language of needs we would not voice. Relearning healthy anger and honest limits is part of returning to the self that adaptation required us to abandon.",
      sources: [{ label: "When the Body Says No", url: "/library/when-the-body-says-no", kind: "book" }],
    },
  ],
};

const newGroundedConversations: GroundedConversation[] = [
  {
    slug: "rolf-potts", name: "Rolf Potts", initials: "RP", accent: "#c3784e",
    identity: "Travel writer, essayist, and author of Vagabonding, a guide to independent long-term travel.",
    preview: "Time is the real wealth.",
    exchanges: [
      {
        question: "What is vagabonding, really?",
        answer: "It is taking an extended stretch away from ordinary life to experience the world on your own terms. The important shift is not a particular destination or budget. It is reclaiming time, simplifying enough to move freely, and treating travel as a way of embracing life rather than briefly escaping it.",
        sources: [{ label: "Vagabonding", url: "/library/vagabonding", kind: "book" }, { label: "Vagabonding · Official book page", url: "https://rolfpotts.com/books/vagabonding/", kind: "article" }],
      },
      {
        question: "Do you need to be rich to travel for months?",
        answer: "You need time wealth more than luxury. Long-term travel becomes possible by simplifying your life, saving deliberately, and lowering the daily cost of moving through the world. The deeper preparation is learning that freedom depends as much on what you can do without as on what you can earn.",
        sources: [{ label: "Vagabonding", url: "/library/vagabonding", kind: "book" }, { label: "Rolf Potts · Time = Wealth", url: "https://rolfpotts.com/videos/", kind: "interview" }],
      },
      {
        question: "Why travel slowly?",
        answer: "Efficiency is useful for transportation and often terrible for experience. Slowing down gives chance, conversation, boredom, and affection time to alter the journey. Stay when a place becomes interesting, wander without turning every hour into an attraction, and let daily life—not a checklist—become the substance of travel.",
        sources: [{ label: "Rolf Potts · Interviews", url: "https://rolfpotts.com/about/interviews/", kind: "interview" }],
      },
      {
        question: "What should guide an itinerary?",
        answer: "Follow specific curiosities rather than generic prestige. A book, a historical question, a style of music, a landscape, or a local ritual can give a journey a living thread. The best motives make you pay attention; they do not merely produce proof that you reached the famous place.",
        sources: [{ label: "The Vagabond Travel Ethos", url: "https://rolfpotts.com/about/interviews/", kind: "interview" }],
      },
      {
        question: "Are loneliness, boredom, and getting lost signs that travel has gone wrong?",
        answer: "They can be part of what makes travel formative. Loneliness pushes you toward people, getting lost forces you to notice, and boredom makes you invent a more interesting day. A journey stripped of all friction may be comfortable, but it also removes many of the conditions that teach you who you are.",
        sources: [{ label: "Rolf Potts · Interviews", url: "https://rolfpotts.com/about/interviews/", kind: "interview" }],
      },
      {
        question: "What should travel change when you return home?",
        answer: "Travel is not complete if its freedom exists only elsewhere. A long journey can make home visible again: its habits, assumptions, comforts, and unnoticed possibilities. Bring the traveler's attention back with you, and ordinary life becomes another place you can enter with curiosity.",
        sources: [{ label: "Vagabonding", url: "/library/vagabonding", kind: "book" }, { label: "Rolf Potts · Interviews", url: "https://rolfpotts.com/about/interviews/", kind: "interview" }],
      },
    ],
  },
  {
    slug: "kevin-kelly", name: "Kevin Kelly", initials: "KK", accent: "#6885a7",
    identity: "Writer, photographer, and founding executive editor of Wired, known for work on technology, optimism, and practical wisdom.",
    preview: "Pay attention to what has your attention.",
    exchanges: [
      {
        question: "What is a good way to handle disagreement?",
        answer: "Look for the part of the other person's position that you can learn from. Disagreement becomes useful when it reveals an assumption, a missing fact, or a different way to frame the problem. You do not have to surrender judgment; you have to remain teachable.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "How do I make decisions for my future self?",
        answer: "Imagine the person who will inherit the consequences and make the choice as a gift to them. The future self is easy to exploit because they cannot object today. Small acts of preparation, health, saving, and courage compound into options that your later self will be grateful to receive.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "What makes travel interesting?",
        answer: "Travel toward your interests, not just toward destinations. A fascination gives you better questions, helps you meet the people who care about the same thing, and turns a place from scenery into participation. Curiosity is a better guidebook than obligation.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "Should creative work be optimized for money?",
        answer: "Make the thing because it deserves to exist and because making it changes you. Money can support the work, but it is an unreliable judge of originality or meaning. The unusual contribution often begins where no market research could have given you permission.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "What should I notice about my attention?",
        answer: "Your attention is the most concrete evidence of what your life is becoming. Notice what repeatedly captures it, what leaves you more alive, and what merely consumes it. Protecting attention is not withdrawal from the world; it is choosing what gets to shape you.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "What matters more than talent?",
        answer: "Showing up, making many attempts, and staying with the work long enough for luck to find you. Talent that waits for ideal conditions produces very little. Persistence creates a larger surface area for discovery and gives your skills time to become distinctive.",
        sources: [{ label: "Excellent Advice for Living", url: "/library/excellent-advice-for-living", kind: "book" }],
      },
      {
        question: "How do I become more fully myself?",
        answer: "Do not measure your life with someone else's ruler. Follow the combination of interests, obligations, weirdness, and generosity that only you can combine. The aim is not to be different for display; it is to become the version of yourself that imitation keeps postponing.",
        sources: [{ label: "Excellent Advice for Living · Official page", url: "https://kk.org/books/excellent-advice-for-living", kind: "book" }],
      },
    ],
  },
  {
    slug: "richard-schwartz", name: "Richard Schwartz", initials: "RS", accent: "#728b72",
    identity: "Psychologist and founder of Internal Family Systems, a model of protective and wounded inner parts guided by a core Self.",
    preview: "There are no bad parts.",
    exchanges: [
      {
        question: "Do we really have multiple parts?",
        answer: "Multiplicity is normal. The mind is not one voice that occasionally malfunctions; it is a system of parts with different feelings, ages, strategies, and responsibilities. Trouble comes less from having parts than from parts being forced into extreme roles and fighting for control.",
        sources: [{ label: "No Bad Parts", url: "/library/no-bad-parts", kind: "book" }, { label: "What is Internal Family Systems?", url: "https://ifs-institute.com/", kind: "research" }],
      },
      {
        question: "What does ‘no bad parts’ mean?",
        answer: "Even a critic, addict, controller, or raging part is usually trying to protect the system with methods learned in an earlier situation. Its behavior can be harmful without its essence being bad. Curiosity helps reveal what it fears and what healthier role it would prefer if it no longer had to protect so intensely.",
        sources: [{ label: "No Bad Parts", url: "https://ifs-institute.com/nobadparts", kind: "book" }],
      },
      {
        question: "What is the Self in IFS?",
        answer: "Self is not another part competing to become the manager. It is the calm, curious, compassionate, clear presence that becomes available when parts soften and give space. Self leadership means relating to the inner system from that presence rather than exiling one part on behalf of another.",
        sources: [{ label: "What is Internal Family Systems?", url: "https://ifs-institute.com/", kind: "research" }],
      },
      {
        question: "What is the difference between a protector and an exile?",
        answer: "Exiles carry pain, shame, fear, or unmet need that the system has tried to keep out of awareness. Managers work to prevent that pain from being triggered; firefighters react urgently once it breaks through. Both kinds of protectors need respect and permission before approaching the vulnerable material they guard.",
        sources: [{ label: "No Bad Parts", url: "/library/no-bad-parts", kind: "book" }],
      },
      {
        question: "What does it mean to unblend from a part?",
        answer: "It means noticing that a feeling or belief is present without making it the entirety of who you are. Ask the part for a little space—not for it to disappear—so you can know it from curiosity. That small separation allows a relationship with the part instead of automatic identification or suppression.",
        sources: [{ label: "No Bad Parts", url: "/library/no-bad-parts", kind: "book" }],
      },
      {
        question: "How can IFS change an argument with another person?",
        answer: "Notice which protective part has taken over and what vulnerable part it is defending. If you can unblend enough to speak for the fear rather than from the attack, the conversation changes. Self-led communication does not abandon boundaries; it makes them clearer and less burdened by old emergencies.",
        sources: [{ label: "IFS Institute", url: "https://ifs-institute.com/", kind: "research" }],
      },
    ],
  },
  {
    slug: "lynne-mctaggart", name: "Lynne McTaggart", initials: "LM", accent: "#a36f97",
    identity: "Journalist and author who writes about consciousness, intention, and her experiments with focused group intention.",
    preview: "What changes when intention becomes collective?",
    exchanges: [
      {
        question: "What is a Power of Eight group?",
        answer: "It is a small group that gathers to hold a specific, compassionate intention for one member or target. My work explores the claim that focused group intention can produce meaningful changes for recipients—and that participating can also transform the people sending the intention.",
        sources: [{ label: "The Power of Eight", url: "/library/the-power-of-eight", kind: "book" }, { label: "The Power of Eight · Official book page", url: "https://lynnemctaggart.com/books/the-power-of-eight/", kind: "book" }],
      },
      {
        question: "Why use a small group?",
        answer: "A small circle is large enough to create a shared focus and intimate enough for members to feel connected and responsible to one another. Eight is a useful name, not a rigid requirement; the practice commonly works with a modest group whose attention can gather around one clear intention.",
        sources: [{ label: "Power of Eight group guide", url: "https://lynnemctaggart.com/wp-content/uploads/2020/10/Power8_leaflet_03b.pdf", kind: "article" }],
      },
      {
        question: "What does a session actually look like?",
        answer: "Choose one recipient and one specific intention, settle into a focused and compassionate state, hold a vivid image of the desired outcome together, then release it rather than straining. Afterward the group shares experiences and keeps track of what happens. The simplicity makes it something people can investigate directly.",
        sources: [{ label: "Power of Eight group guide", url: "https://lynnemctaggart.com/wp-content/uploads/2020/10/Power8_leaflet_03b.pdf", kind: "article" }],
      },
      {
        question: "Why might helping someone else affect the sender?",
        answer: "I describe a mirror or boomerang effect: moving attention away from one's own problem and into compassionate service can reduce isolation and reorganize the sender's experience. I regard this as one of the most striking patterns reported in the groups, even though the proposed mechanism remains a matter of investigation.",
        sources: [{ label: "The Power of Eight · Official book page", url: "https://lynnemctaggart.com/books/the-power-of-eight/", kind: "book" }],
      },
      {
        question: "How should a curious person approach these claims?",
        answer: "Try the practice carefully, make the intention concrete, keep records, and remain attentive to both results and interpretation. The purpose is not to force belief. It is to combine disciplined attention with direct experience and see whether a repeated group practice changes anything observable in the recipient or the group.",
        sources: [{ label: "The Power of Eight", url: "/library/the-power-of-eight", kind: "book" }],
      },
    ],
  },
  {
    slug: "paul-millerd", name: "Paul Millerd", initials: "PM", accent: "#bb8556",
    identity: "Writer and author of The Pathless Path, exploring alternatives to the default relationship with work and success.",
    preview: "What if work is not the center?",
    exchanges: [
      {
        question: "What is the pathless path?",
        answer: "It is a way of moving through life without outsourcing the definition of a good life to an established career script. There is still work, commitment, and uncertainty, but the organizing question changes from ‘How do I win the default game?’ to ‘What kind of life am I actually trying to live?’",
        sources: [{ label: "The Pathless Path · Official store", url: "https://shop.pathlesspath.com/products/pathless-path-hardcover", kind: "book" }, { label: "Pathless · About", url: "https://newsletter.pathlesspath.com/about", kind: "article" }],
      },
      {
        question: "What is the default path?",
        answer: "It is the inherited sequence of credentials, respectable jobs, promotions, and deferred enjoyment that presents itself as the only serious option. The problem is not that the path is always bad. It is that people can become very successful at it without ever deciding whether its destination belongs to them.",
        sources: [{ label: "The Pathless Path · Official store", url: "https://shop.pathlesspath.com/products/pathless-path-hardcover", kind: "book" }],
      },
      {
        question: "How do I know whether work has swallowed my identity?",
        answer: "Notice what remains when the job title is removed. If rest feels guilty, conversation returns automatically to work, and every interest must justify itself through income or status, the job may have become the primary source of legitimacy. A broader identity makes work one meaningful part of life rather than its unquestioned center.",
        sources: [{ label: "Pathless · About", url: "https://newsletter.pathlesspath.com/about", kind: "article" }],
      },
      {
        question: "Do I need to quit everything to begin?",
        answer: "No. Small experiments can reveal more than dramatic declarations: reduce expenses, protect an unscheduled day, try independent work, take a deliberate break, or follow a curiosity without demanding a business model. The aim is to create evidence about the life you want before replacing one rigid identity with another.",
        sources: [{ label: "Pathless newsletter", url: "https://newsletter.pathlesspath.com/", kind: "article" }],
      },
      {
        question: "What role does money play on a pathless path?",
        answer: "Money matters because it buys time and lowers certain forms of fear, but the number called ‘enough’ cannot remain undefined. If every increase in income expands the life that must be maintained, freedom keeps receding. A clear sense of enough can turn money back into a tool rather than a scoreboard.",
        sources: [{ label: "The Pathless Path · Official store", url: "https://shop.pathlesspath.com/products/pathless-path-hardcover", kind: "book" }],
      },
      {
        question: "How do you live with the uncertainty?",
        answer: "By treating uncertainty as the territory rather than evidence that you made a mistake. The path emerges through experiments, conversations, seasons of work, and periods that look unproductive from the default path. You trade some legibility for a life that feels more alive and more honestly yours.",
        sources: [{ label: "Pathless · About", url: "https://newsletter.pathlesspath.com/about", kind: "article" }],
      },
    ],
  },
];

export const groundedConversations: GroundedConversation[] = [
  ...initialGroundedConversations.map((conversation) => ({
    ...conversation,
    exchanges: [...conversation.exchanges, ...(addedExchanges[conversation.slug] ?? [])],
  })),
  ...newGroundedConversations,
];
