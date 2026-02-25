export interface EmailVerificationCheckerRequestProps {
  code: string;
}

export interface ChangePasswordRequestProps {
  password: string;
  passwordConfirm: string;
}
