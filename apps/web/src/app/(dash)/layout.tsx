import { Dashboard } from '@/components/Dashboard';

/** The dashboard lives in the layout so its state (open dialogs, new requests) survives moving between views. */
export default function DashboardLayout() {
  return <Dashboard />;
}
