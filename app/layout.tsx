import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Planogram Studio Pro",description:"Build, manage and present professional planograms with drag-and-drop products, accurate sizing and capacity planning.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export const viewport:Viewport={width:"device-width",initialScale:1,maximumScale:5,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
