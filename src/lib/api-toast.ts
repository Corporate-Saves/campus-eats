import toast from "react-hot-toast";

/** Default copy for failed HTTP / unexpected API failures (Sentry can hook later). */
export const API_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export function toastApiError(): void {
  toast.error(API_ERROR_MESSAGE);
}
