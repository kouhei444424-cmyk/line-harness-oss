import assert from 'node:assert/strict';
import {
  KAMEN_CONSULTATION_OWNER_NOTIFICATION_TEXT,
  notifyKamenConsultationOwner,
} from '../apps/worker/src/services/kamen-consultation-owner-notification.ts';

const baseEnv = {
  KAMEN_CONSULTATION_NOTIFY_ENABLED: 'true',
  KAMEN_CONSULTATION_LINE_CHANNEL_ID: 'channel-kamen',
  KAMEN_CONSULTATION_OWNER_LINE_USER_ID: 'owner-user',
};

function fakeClient() {
  const calls = [];
  return {
    calls,
    async pushMessage(to, messages) {
      calls.push({ to, messages });
    },
  };
}

{
  const lineClient = fakeClient();
  const sent = await notifyKamenConsultationOwner({
    env: baseEnv,
    lineClient,
    lineChannelId: 'channel-kamen',
    sourceUserId: 'consultation-user',
  });

  assert.equal(sent, true);
  assert.deepEqual(lineClient.calls, [
    {
      to: 'owner-user',
      messages: [
        {
          type: 'text',
          text: KAMEN_CONSULTATION_OWNER_NOTIFICATION_TEXT,
        },
      ],
    },
  ]);
}

for (const testCase of [
  {
    name: 'disabled',
    env: { ...baseEnv, KAMEN_CONSULTATION_NOTIFY_ENABLED: 'false' },
    lineChannelId: 'channel-kamen',
    sourceUserId: 'consultation-user',
  },
  {
    name: 'different LINE channel',
    env: baseEnv,
    lineChannelId: 'channel-other',
    sourceUserId: 'consultation-user',
  },
  {
    name: 'message sent by the owner',
    env: baseEnv,
    lineChannelId: 'channel-kamen',
    sourceUserId: 'owner-user',
  },
  {
    name: 'owner secret missing',
    env: {
      KAMEN_CONSULTATION_NOTIFY_ENABLED: 'true',
      KAMEN_CONSULTATION_LINE_CHANNEL_ID: 'channel-kamen',
    },
    lineChannelId: 'channel-kamen',
    sourceUserId: 'consultation-user',
  },
]) {
  const lineClient = fakeClient();
  const sent = await notifyKamenConsultationOwner({
    env: testCase.env,
    lineClient,
    lineChannelId: testCase.lineChannelId,
    sourceUserId: testCase.sourceUserId,
  });

  assert.equal(sent, false, testCase.name);
  assert.deepEqual(lineClient.calls, [], testCase.name);
}

console.log('kamen owner LINE notification tests passed');
