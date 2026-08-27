export const KAMEN_CONSULTATION_OWNER_NOTIFICATION_TEXT =
  '仮面相談室に新しいメッセージが届きました。\nLINE公式アカウント管理画面を確認してください。';

type NotificationEnv = {
  KAMEN_CONSULTATION_NOTIFY_ENABLED?: string;
  KAMEN_CONSULTATION_LINE_CHANNEL_ID?: string;
  KAMEN_CONSULTATION_OWNER_LINE_USER_ID?: string;
};

type LinePushClient = {
  pushMessage(
    to: string,
    messages: Array<{ type: 'text'; text: string }>,
  ): Promise<void>;
};

type NotificationInput = {
  env: NotificationEnv;
  lineClient: LinePushClient;
  lineChannelId: string | null;
  sourceUserId: string;
};

export function shouldNotifyKamenConsultationOwner({
  env,
  lineChannelId,
  sourceUserId,
}: Omit<NotificationInput, 'lineClient'>): boolean {
  const ownerUserId = env.KAMEN_CONSULTATION_OWNER_LINE_USER_ID?.trim();
  const targetChannelId = env.KAMEN_CONSULTATION_LINE_CHANNEL_ID?.trim();

  return Boolean(
    env.KAMEN_CONSULTATION_NOTIFY_ENABLED === 'true' &&
      ownerUserId &&
      targetChannelId &&
      lineChannelId === targetChannelId &&
      sourceUserId !== ownerUserId,
  );
}

export async function notifyKamenConsultationOwner(
  input: NotificationInput,
): Promise<boolean> {
  if (!shouldNotifyKamenConsultationOwner(input)) return false;

  const ownerUserId = input.env.KAMEN_CONSULTATION_OWNER_LINE_USER_ID!.trim();
  await input.lineClient.pushMessage(ownerUserId, [
    {
      type: 'text',
      text: KAMEN_CONSULTATION_OWNER_NOTIFICATION_TEXT,
    },
  ]);
  return true;
}
