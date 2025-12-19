// src/components/logo-motorpulse.tsx
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  showText?: boolean;
  className?: string;
};

function MotorPulseIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M6 12h3l1.5-3 3 6 1.5-3h3" />
    </svg>
  );
}

export function MotorPulseLogoSimple({ size = 24, showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-foreground", className)}>
      <MotorPulseIcon size={size} className="text-primary" />
      {showText && <span className="font-semibold text-lg tracking-tight">MotorPulse</span>}
    </div>
  );
}

export function MotorPulseLogo3D({ size = 22, showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl",
          "bg-gradient-to-br from-primary/90 via-primary to-primary/70",
          "shadow-lg shadow-primary/40",
          "border border-primary/50",
          "px-3 py-2",
          "rotate-[-3deg]"
        )}
      >
        <div className="absolute inset-0 rounded-2xl bg-white/5 mix-blend-screen" />
        <MotorPulseIcon
          size={size}
          className="relative text-primary-foreground drop-shadow-[0_0_6px_rgba(0,0,0,0.4)]"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-lg tracking-tight">MotorPulse</span>
          <span className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
            Telemetry Dash
          </span>
        </div>
      )}
    </div>
  );
}

export function MotorPulseLogoAnimated({ size = 22, showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-primary/25 animate-ping" />
        </div>

        <div
          className={cn(
            "relative flex items-center justify-center rounded-2xl",
            "bg-gradient-to-br from-primary/90 via-primary to-primary/70",
            "shadow-lg shadow-primary/40",
            "border border-primary/50",
            "px-3 py-2"
          )}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/10 mix-blend-screen" />
          <MotorPulseIcon
            size={size}
            className="relative text-primary-foreground animate-[pulse_2s_ease-in-out_infinite]"
          />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-lg tracking-tight">MotorPulse</span>
          <span className="text-[0.68rem] text-muted-foreground uppercase tracking-[0.25em]">
            Motor Telemetry
          </span>
        </div>
      )}
    </div>
  );
}
