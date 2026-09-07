import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  COUNTRY_CODES,
  CountryCode,
  DEFAULT_COUNTRY_ISO,
  findCountryByIso,
  isoToFlag,
} from "@/lib/country-codes";

const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

export interface PhoneInputProps {
  countryIso: string;
  digits: string;
  onCountryIsoChange: (iso: string) => void;
  onDigitsChange: (digits: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Show the "incomplete" message under the field. Owned by the parent. */
  showError?: boolean;
  className?: string;
}

/** Strip everything that isn't a digit and clamp to MAX_PHONE_DIGITS. */
export function sanitizePhoneDigits(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
}

/** Returns true when the digits look like a complete subscriber number. */
export function isPhoneDigitsValid(digits: string): boolean {
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/** Combined E.164-ish value, e.g. "+13055550199". Empty string when no digits. */
export function buildE164(countryIso: string, digits: string): string {
  if (!digits) return "";
  const country = findCountryByIso(countryIso) ?? findCountryByIso(DEFAULT_COUNTRY_ISO)!;
  return `+${country.dialCode}${digits}`;
}

/**
 * Two-part phone input (country selector + digits). The parent owns both
 * pieces of state so it can persist them and normalize the final value.
 */
export function PhoneInput({
  countryIso,
  digits,
  onCountryIsoChange,
  onDigitsChange,
  id,
  placeholder = "Phone number",
  disabled = false,
  showError = false,
  className,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  const country =
    findCountryByIso(countryIso) ??
    findCountryByIso(DEFAULT_COUNTRY_ISO)!;

  const incomplete = digits.length > 0 && !isPhoneDigitsValid(digits);

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className={cn(
          "flex h-11 items-stretch gap-0 rounded-xl border border-border/40 bg-background/60 focus-within:border-primary/50 transition-colors",
          showError && incomplete && "border-destructive/60 focus-within:border-destructive",
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-full shrink-0 gap-1.5 rounded-l-xl rounded-r-none border-r border-border/40 px-2.5 text-sm font-medium hover:bg-muted/40"
            >
              <span aria-hidden className="text-base leading-none">
                {isoToFlag(country.iso)}
              </span>
              <span className="tabular-nums">+{country.dialCode}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[300px] p-0"
            // Stay on top of dialogs/sheets without clipping the search input.
            sideOffset={4}
          >
            <Command
              filter={(value, search) => {
                if (!search) return 1;
                const needle = search.toLowerCase().replace(/^\+/, "");
                return value.toLowerCase().includes(needle) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Search country or +code" />
              <CommandList>
                <CommandEmpty>No countries found.</CommandEmpty>
                <CommandGroup>
                  {COUNTRY_CODES.map((c: CountryCode) => {
                    // Make every country searchable by name AND its calling
                    // code (with or without a leading "+").
                    const value = `${c.name} ${c.dialCode} +${c.dialCode}`;
                    const selected = c.iso === country.iso;
                    return (
                      <CommandItem
                        key={c.iso}
                        value={value}
                        onSelect={() => {
                          onCountryIsoChange(c.iso);
                          setOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <span aria-hidden className="mr-2 text-base leading-none">
                          {isoToFlag(c.iso)}
                        </span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="ml-2 text-muted-foreground tabular-nums">
                          +{c.dialCode}
                        </span>
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={digits}
          disabled={disabled}
          onChange={(e) => onDigitsChange(sanitizePhoneDigits(e.target.value))}
          aria-invalid={showError && incomplete}
          className="h-full flex-1 rounded-l-none rounded-r-xl border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {showError && incomplete && (
        <p className="text-[11px] font-medium text-destructive">Phone number is incomplete.</p>
      )}
    </div>
  );
}

export { MIN_PHONE_DIGITS, MAX_PHONE_DIGITS };
