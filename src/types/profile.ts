export type Profile = {
  id: string;
  institution_id: string | null;
  canteen_id: string | null;
  full_name: string | null;
  role: string;
  student_id: string | null;
  wallet_balance: number;
  fcm_token: string | null;
  created_at: string;
};
