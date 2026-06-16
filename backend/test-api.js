const BASE_URL = 'http://localhost:5000/api';

async function testApp() {
  console.log('--- starting API verification ---');

  // 1. Test login
  console.log('1. Attempting login as admin...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const { token } = await loginRes.json();
  console.log('Login successful! Token acquired.');

  // 2. Test profile fetching
  console.log('\n2. Fetching profile using token...');
  const profileRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!profileRes.ok) {
    console.error('Profile fetch failed:', await profileRes.text());
    process.exit(1);
  }

  const profile = await profileRes.json();
  console.log(`Profile verified. Username: ${profile.username}`);

  // 3. Test sending bulk mail
  console.log('\n3. Triggering bulk email sending (Ethereal test mode)...');
  const mailPayload = {
    subject: 'Verification Test Campaign',
    body: '<h1>Verification Success</h1><p>This is a bulk mail verification email sent from the test-api script.</p>',
    recipients: 'test1@example.com, test2@example.com'
  };

  const sendRes = await fetch(`${BASE_URL}/mail/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(mailPayload)
  });

  if (!sendRes.ok) {
    console.error('Bulk mail trigger failed:', await sendRes.text());
    process.exit(1);
  }

  const campaign = await sendRes.json();
  console.log(`Campaign triggered! ID: ${campaign.campaignId}, Total recipients: ${campaign.totalCount}`);

  // 4. Poll status until complete
  console.log('\n4. Polling campaign status...');
  let finished = false;
  let attempts = 0;

  while (!finished && attempts < 10) {
    attempts++;
    await new Promise(r => setTimeout(r, 2000));
    
    const statusRes = await fetch(`${BASE_URL}/mail/status/${campaign.campaignId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!statusRes.ok) {
      console.error('Status fetch failed:', await statusRes.text());
      break;
    }
    
    const campaignStatus = await statusRes.json();
    console.log(`Attempt ${attempts}: Status: ${campaignStatus.status} | Sent: ${campaignStatus.successCount} | Failed: ${campaignStatus.failureCount}`);
    
    if (['success', 'failed', 'partial'].includes(campaignStatus.status)) {
      finished = true;
      console.log('\nCampaign Finished! Details:');
      campaignStatus.recipients.forEach((rec, idx) => {
        console.log(`- Recipient ${idx + 1}: ${rec.email} | Status: ${rec.status} | Preview Link: ${rec.previewUrl || 'none'}`);
      });
      break;
    }
  }

  // 5. Check stats API
  console.log('\n5. Fetching overall app statistics...');
  const statsRes = await fetch(`${BASE_URL}/mail/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (statsRes.ok) {
    const stats = await statsRes.json();
    console.log('Stats:', stats);
  } else {
    console.error('Failed to fetch stats:', await statsRes.text());
  }

  console.log('\n--- API verification completed successfully ---');
}

testApp().catch(console.error);
