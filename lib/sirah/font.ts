import localFont from "next/font/local";
export const sirahFont = localFont({
  src: [
    { path: "../../public/fonts/montserrat/montserrat-400.ttf", weight: "400" },
    { path: "../../public/fonts/montserrat/montserrat-500.ttf", weight: "500" },
    { path: "../../public/fonts/montserrat/montserrat-600.ttf", weight: "600" },
    { path: "../../public/fonts/montserrat/montserrat-700.ttf", weight: "700" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});
