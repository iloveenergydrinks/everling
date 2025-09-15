// Popular countries with their flags and dial codes
export const countries = [
  { code: 'US', flag: '🇺🇸', dialCode: '+1', name: 'United States' },
  { code: 'GB', flag: '🇬🇧', dialCode: '+44', name: 'United Kingdom' },
  { code: 'CA', flag: '🇨🇦', dialCode: '+1', name: 'Canada' },
  { code: 'AU', flag: '🇦🇺', dialCode: '+61', name: 'Australia' },
  { code: 'DE', flag: '🇩🇪', dialCode: '+49', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', dialCode: '+33', name: 'France' },
  { code: 'IT', flag: '🇮🇹', dialCode: '+39', name: 'Italy' },
  { code: 'ES', flag: '🇪🇸', dialCode: '+34', name: 'Spain' },
  { code: 'NL', flag: '🇳🇱', dialCode: '+31', name: 'Netherlands' },
  { code: 'BE', flag: '🇧🇪', dialCode: '+32', name: 'Belgium' },
  { code: 'CH', flag: '🇨🇭', dialCode: '+41', name: 'Switzerland' },
  { code: 'AT', flag: '🇦🇹', dialCode: '+43', name: 'Austria' },
  { code: 'SE', flag: '🇸🇪', dialCode: '+46', name: 'Sweden' },
  { code: 'NO', flag: '🇳🇴', dialCode: '+47', name: 'Norway' },
  { code: 'DK', flag: '🇩🇰', dialCode: '+45', name: 'Denmark' },
  { code: 'FI', flag: '🇫🇮', dialCode: '+358', name: 'Finland' },
  { code: 'IE', flag: '🇮🇪', dialCode: '+353', name: 'Ireland' },
  { code: 'PT', flag: '🇵🇹', dialCode: '+351', name: 'Portugal' },
  { code: 'PL', flag: '🇵🇱', dialCode: '+48', name: 'Poland' },
  { code: 'CZ', flag: '🇨🇿', dialCode: '+420', name: 'Czech Republic' },
  { code: 'GR', flag: '🇬🇷', dialCode: '+30', name: 'Greece' },
  { code: 'TR', flag: '🇹🇷', dialCode: '+90', name: 'Turkey' },
  { code: 'RU', flag: '🇷🇺', dialCode: '+7', name: 'Russia' },
  { code: 'UA', flag: '🇺🇦', dialCode: '+380', name: 'Ukraine' },
  { code: 'IN', flag: '🇮🇳', dialCode: '+91', name: 'India' },
  { code: 'CN', flag: '🇨🇳', dialCode: '+86', name: 'China' },
  { code: 'JP', flag: '🇯🇵', dialCode: '+81', name: 'Japan' },
  { code: 'KR', flag: '🇰🇷', dialCode: '+82', name: 'South Korea' },
  { code: 'SG', flag: '🇸🇬', dialCode: '+65', name: 'Singapore' },
  { code: 'HK', flag: '🇭🇰', dialCode: '+852', name: 'Hong Kong' },
  { code: 'TW', flag: '🇹🇼', dialCode: '+886', name: 'Taiwan' },
  { code: 'TH', flag: '🇹🇭', dialCode: '+66', name: 'Thailand' },
  { code: 'MY', flag: '🇲🇾', dialCode: '+60', name: 'Malaysia' },
  { code: 'ID', flag: '🇮🇩', dialCode: '+62', name: 'Indonesia' },
  { code: 'PH', flag: '🇵🇭', dialCode: '+63', name: 'Philippines' },
  { code: 'VN', flag: '🇻🇳', dialCode: '+84', name: 'Vietnam' },
  { code: 'AE', flag: '🇦🇪', dialCode: '+971', name: 'UAE' },
  { code: 'SA', flag: '🇸🇦', dialCode: '+966', name: 'Saudi Arabia' },
  { code: 'IL', flag: '🇮🇱', dialCode: '+972', name: 'Israel' },
  { code: 'ZA', flag: '🇿🇦', dialCode: '+27', name: 'South Africa' },
  { code: 'NG', flag: '🇳🇬', dialCode: '+234', name: 'Nigeria' },
  { code: 'EG', flag: '🇪🇬', dialCode: '+20', name: 'Egypt' },
  { code: 'KE', flag: '🇰🇪', dialCode: '+254', name: 'Kenya' },
  { code: 'BR', flag: '🇧🇷', dialCode: '+55', name: 'Brazil' },
  { code: 'MX', flag: '🇲🇽', dialCode: '+52', name: 'Mexico' },
  { code: 'AR', flag: '🇦🇷', dialCode: '+54', name: 'Argentina' },
  { code: 'CO', flag: '🇨🇴', dialCode: '+57', name: 'Colombia' },
  { code: 'CL', flag: '🇨🇱', dialCode: '+56', name: 'Chile' },
  { code: 'PE', flag: '🇵🇪', dialCode: '+51', name: 'Peru' },
  { code: 'NZ', flag: '🇳🇿', dialCode: '+64', name: 'New Zealand' },
]

// Get default country based on timezone
export function getDefaultCountry() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  
  // Map common timezones to country codes
  if (timezone.includes('America/New_York') || timezone.includes('America/Los_Angeles')) return 'US'
  if (timezone.includes('Europe/London')) return 'GB'
  if (timezone.includes('Europe/Paris')) return 'FR'
  if (timezone.includes('Europe/Berlin')) return 'DE'
  if (timezone.includes('Europe/Rome')) return 'IT'
  if (timezone.includes('Europe/Madrid')) return 'ES'
  if (timezone.includes('Asia/Tokyo')) return 'JP'
  if (timezone.includes('Asia/Shanghai')) return 'CN'
  if (timezone.includes('Asia/Kolkata')) return 'IN'
  if (timezone.includes('Australia/Sydney')) return 'AU'
  if (timezone.includes('America/Toronto')) return 'CA'
  if (timezone.includes('America/Mexico_City')) return 'MX'
  if (timezone.includes('America/Sao_Paulo')) return 'BR'
  
  // Default to US if we can't determine
  return 'US'
}

// Format phone number with country code
export function formatPhoneNumber(countryCode: string, phoneNumber: string) {
  const country = countries.find(c => c.code === countryCode)
  if (!country) return phoneNumber
  
  // Remove any existing country code or + from the number
  let cleaned = phoneNumber.replace(/^\+\d+\s?/, '').replace(/\D/g, '')
  
  // Return formatted number
  return `${country.dialCode}${cleaned}`
}
