import { useLocalSearchParams } from 'expo-router';

import { ComingSoon } from '@/components/ui';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ComingSoon
      title="Contact detail"
      description={`Next milestone: review each number for this contact (${id}) individually and choose exactly which ones to update.`}
    />
  );
}
