/**
 * NYXEL Interactive Avatar Widget — configuration
 *
 * This file is public in a static web app. Never place passwords, API keys,
 * access tokens or any other secret here.
 */
window.NYXEL_CONFIG = {
  // Identity and contact
  name: "NYXEL",
  email: "creatixprojet@gmail.com",
  emailSubject: "Contact depuis CR3@TIX Project Map",
  emailBody: "Bonjour CR3@TIX,\n\nJe vous contacte depuis NYXEL sur CR3@TIX Project Map.",

  // Placement: bottom-right | bottom-left | top-right | top-left
  position: "bottom-right",
  // Taille volontairement compacte pour rester à côté des commandes de zoom.
  scale: 0.82,
  zIndex: 2147483000,

  // Behaviour
  animations: true,
  greeting: true,
  // Organic reactions continue while the application is being used. NYXEL
  // cycles through every reaction before reusing one, without close repeats.
  reactionMinDelay: 3500,
  reactionMaxDelay: 7500,

  // Sleep only after 3 to 5 minutes without pointer, touch, keyboard,
  // scrolling or form activity anywhere in the host application.
  sleepAfter: 180000,
  sleepVariance: 120000,

  // Rare CR3@TIX holographic signature. With chance: 1 it plays once
  // per browser/PWA session, at a random moment between 75 and 135 seconds.
  // Lower chance (for example 0.25) to limit it to 25% of sessions.
  signature: {
    enabled: true,
    chance: 1,
    minDelay: 75000,
    maxDelay: 135000,
    duration: 4800,
    asset: "nyxel-signature.png",
    sessionKey: "nyxel-cr3atix-map-signature-v2"
  },
  sounds: false,

  // Wording
  contactLabel: "Contacter CR3@TIX",
  messages: {
    eyebrow: "Mascotte numérique",
    title: "NYXEL",
    contact: "Besoin de contacter CR3@TIX ?",
    email: "Envoyer un e-mail",
    close: "Fermer le panneau de contact"
  },

  // Enable a link and fill its URL to display it in the contact panel.
  links: [
    { id: "website", label: "Site Internet", url: "", enabled: false },
    { id: "instagram", label: "Instagram", url: "", enabled: false },
    { id: "github", label: "GitHub", url: "", enabled: false },
    { id: "redbubble", label: "Redbubble", url: "", enabled: false }
  ],

  // Optional override. Leave empty to resolve assets beside nyxel.js.
  assetBase: "",

  // Keep false in normal applications. The demo overrides it locally.
  debug: false
};
