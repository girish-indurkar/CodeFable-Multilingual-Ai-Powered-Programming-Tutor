import { BookOpen, Code2, Lightbulb, Sparkles } from "lucide-react";
import { AnimatedCard } from "@/components/ui/animated-card";
import { AuthForm } from "@/components/AuthForm";

export default function Home() {
  return (
    <main className="min-h-screen lg:h-screen grid lg:grid-cols-2 relative lg:overflow-hidden">
      {/* Left Column */}
      <div className="flex flex-col justify-center px-5 py-8 sm:p-8 lg:px-20 lg:py-10 relative z-10">
        <div className="max-w-2xl mx-auto lg:mx-0">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              C
            </div>
            <span className="text-xl font-bold text-primary tracking-wide">
              CodeFable
            </span>
          </div>

          {/* Hero Section */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3 sm:mb-4">
            Learn Programming through <br />
            <span className="font-serif text-primary italic pr-4">Storytelling</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed max-w-xl">
            Understand Programming problems and code through AI-powered stories, hints, and visual explanations. From beginner to interview-ready.
          </p>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <AnimatedCard>
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-1.5 sm:mb-2" />
              <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Story Mode</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Complex Programming problems become simple, fun stories
              </p>
            </AnimatedCard>
            
            <AnimatedCard>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-1.5 sm:mb-2" />
              <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">AI Powered</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Powered by advanced AI for optimal learning
              </p>
            </AnimatedCard>

            <AnimatedCard>
              <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-1.5 sm:mb-2" />
              <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Code Editor</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Write and practice in 8 programming languages
              </p>
            </AnimatedCard>

            <AnimatedCard>
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-1.5 sm:mb-2" />
              <h3 className="font-semibold text-base sm:text-lg mb-0.5 sm:mb-1">Multilingual AI</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                AI explains in English, Hindi, Hinglish or Marathi
              </p>
            </AnimatedCard>
          </div>
        </div>
      </div>

      {/* Right Column (Auth Form - Desktop) */}
      <div className="hidden lg:flex items-center justify-center p-8 bg-[#0b0b0f] border-l border-white/5 relative z-10">
        <AuthForm />
      </div>

      {/* Mobile Auth Form */}
      <div className="lg:hidden px-5 pb-8 sm:p-8 flex justify-center">
         <AuthForm />
      </div>
      
      {/* Background ambient glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-primary/5 rounded-full blur-[120px]" />
      </div>
    </main>
  );
}
