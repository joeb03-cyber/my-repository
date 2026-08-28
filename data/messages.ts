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

export const groundedConversations: GroundedConversation[] = [
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
