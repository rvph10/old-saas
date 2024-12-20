import { FakeAccountGenerator } from "./src/lib/fake-account-generator.js";

async function main() {
  const generator = new FakeAccountGenerator();
  
  // Get number of accounts to generate from command line
  const numAccounts = process.argv[2] ? parseInt(process.argv[2], 10) : 1;
  
  try {
    const accounts = [];
    for (let i = 0; i < numAccounts; i++) {
      const account = generator.generateFakeAccount();
      generator.saveAccount(account);
      accounts.push(account);
    }
    
    console.log(`Successfully generated ${accounts.length} accounts:`);
    accounts.forEach((account, index) => {
      console.log(`\nAccount ${index + 1}:`);
      console.log(`Email: ${account.email}`);
      console.log(`Username: ${account.username}`);
      console.log(`Password: ${account.password}`);
    });
  } catch (error) {
    console.error('Error generating accounts:', error);
  }
}

main().catch(console.error);