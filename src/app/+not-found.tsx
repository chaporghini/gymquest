import { router } from 'expo-router';
import { MapPinOff } from 'lucide-react-native';

import { EmptyState, Screen } from '@/components';

export default function NotFound() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon={MapPinOff}
        title="Seite nicht gefunden"
        message="Diesen Bereich gibt es nicht (mehr)."
        actionLabel="Zur Startseite"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
