async function test() {
  try {
    const sdk = await import('stellar-sdk');
    console.log('Legacy sdk type:', typeof sdk);
    console.log('Legacy sdk has TransactionBuilder:', !!sdk.TransactionBuilder);
    console.log('Legacy sdk keys:', Object.keys(sdk).slice(0, 10));
  } catch (err) {
    console.error('Import failed:', err);
  }
}
test();
