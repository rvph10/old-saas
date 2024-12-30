import { FakeAccountGenerator } from './src/lib/fake-account-generator.js';

async function main(count = 10) {
  try {
    const generator = new FakeAccountGenerator();

    console.log(`Generating ${count} fake accounts...`);

    for (let i = 0; i < count; i++) {
      const account = generator.generateFakeAccount();
      generator.saveAccount(account);
      console.log(`Generated account ${i + 1}/${count}: ${account.email}`);
    }

    console.log('\nGenerated accounts successfully!');
  } catch (error) {
    console.error('Error generating accounts:', error);
  }
}

// Get count from command line arguments
const count = parseInt(process.argv[2]) || 10;
main(count);
