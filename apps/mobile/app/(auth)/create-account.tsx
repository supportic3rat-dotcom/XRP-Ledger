import { Redirect } from 'expo-router';

/** Accounts are created with the crypto trust (the trust form asks for the email and password). */
export default function CreateAccountRoute() {
  return <Redirect href={{ pathname: '/trust', params: { from: 'create' } }} />;
}
