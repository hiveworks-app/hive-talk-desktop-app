export type MemberType = 'CORPORATE' | 'INDIVIDUAL';

export interface SignupTerm {
  id: number;
  version: number;
  code: string;
  type: string;
  title: string;
  description: string;
  isRequired: boolean;
  effectiveAt: string;
}

export interface SignupTermsPayload {
  items: SignupTerm[];
}

export interface SignupTermItem {
  id: number;
  isAgreed: boolean;
}

export interface SignupRequestProps {
  email: string;
  name: string;
  password: string;
  passwordConfirm: string;
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  department?: string;
  job?: string;
  termsList: SignupTermItem[];
  // Corporate only
  brn?: string;
  companyName?: string;
  ceoName?: string;
  openingAt?: string;
}

export interface SendSmsRequestProps {
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
}

export interface VerifySmsRequestProps {
  phoneHead: string;
  phoneMid: string;
  phoneTail: string;
  code: string;
}

export interface VerifyBusinessRequestProps {
  brn: string;
  companyName: string;
  ceoName: string;
  openingAt: string;
}
