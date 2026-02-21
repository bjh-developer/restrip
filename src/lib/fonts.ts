import {
  Inter, Playfair_Display, Caveat, Dancing_Script, Pacifico,
  Oswald, Roboto_Mono, Arimo, Montserrat, League_Spartan,
  Anton, Lora, Shrikhand, Pinyon_Script
} from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const playfairDisplay = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
export const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });
export const dancingScript = Dancing_Script({ subsets: ["latin"], variable: "--font-dancing" });
export const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico" });
export const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" });
export const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" });
export const arimo = Arimo({ subsets: ["latin"], variable: "--font-arimo" });
export const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
export const leagueSpartan = League_Spartan({ subsets: ["latin"], variable: "--font-league-spartan" });
export const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
export const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
export const shrikhand = Shrikhand({ subsets: ["latin"], weight: "400", variable: "--font-shrikhand" });
export const pinyonScript = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-pinyon-script" });

export const fontClassNames = [
  inter, playfairDisplay, caveat, dancingScript, pacifico,
  oswald, robotoMono, arimo, montserrat, leagueSpartan,
  anton, lora, shrikhand, pinyonScript
].map((f) => f.variable).join(" ");