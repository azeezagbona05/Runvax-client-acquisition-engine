import { BedDouble, Boxes, Building2, Calculator, CalendarDays, Car, Code2, Factory, FileText, GraduationCap, HardHat, Home, Megaphone, Scale, Sparkles, Stethoscope, Sun, Truck, UtensilsCrossed, Users, type LucideIcon } from 'lucide-react';
import type { TemplateConfig } from '@/lib/templateLibrary';

/** One icon per template and industry. */
export const TEMPLATE_ICON: Record<TemplateConfig['art']['icon'], LucideIcon> = {
  dental: Stethoscope, restaurant: UtensilsCrossed, hotel: BedDouble, property: Home, custom: FileText,
  building: Building2, stethoscope: Stethoscope, megaphone: Megaphone, scale: Scale, calculator: Calculator, code: Code2, sun: Sun, truck: Truck, hardhat: HardHat,
  sparkles: Sparkles, car: Car, users: Users, school: GraduationCap, boxes: Boxes, factory: Factory, calendar: CalendarDays,
};
