import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';

export class FakeAccountGenerator {
  accountsFilePath;

  constructor() {
    // Ensure the accounts directory exists
    const accountsDir = path.join(process.cwd(), 'fake-accounts');
    if (!fs.existsSync(accountsDir)) {
      fs.mkdirSync(accountsDir);
    }
    this.accountsFilePath = path.join(accountsDir, 'accounts.json');
  }

  generatePassword(length = 12) {
    // Create a password with uppercase, lowercase, numbers, and special characters
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
    
    let password = '';
    password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    password += numberChars[Math.floor(Math.random() * numberChars.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];
    
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  generateFakeAccount() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      email: faker.internet.email({ 
        firstName: firstName.toLowerCase(), 
        lastName: lastName.toLowerCase() 
      }),
      username: faker.internet.userName({ 
        firstName: firstName.toLowerCase(), 
        lastName: lastName.toLowerCase() 
      }),
      password: this.generatePassword(),
      firstName,
      lastName,
      registrationTimestamp: new Date().toISOString()
    };
  }

  saveAccount(account) {
    let accounts = [];
    
    // Read existing accounts
    if (fs.existsSync(this.accountsFilePath)) {
      const fileContent = fs.readFileSync(this.accountsFilePath, 'utf-8');
      accounts = JSON.parse(fileContent);
    }

    // Check if account already exists
    const existingAccountIndex = accounts.findIndex(
      a => a.email === account.email || a.username === account.username
    );

    if (existingAccountIndex !== -1) {
      // Update existing account
      accounts[existingAccountIndex] = account;
    } else {
      // Add new account
      accounts.push(account);
    }

    // Write updated accounts
    fs.writeFileSync(
      this.accountsFilePath, 
      JSON.stringify(accounts, null, 2), 
      'utf-8'
    );
  }

  listAccounts() {
    if (!fs.existsSync(this.accountsFilePath)) {
      return [];
    }

    const fileContent = fs.readFileSync(this.accountsFilePath, 'utf-8');
    return JSON.parse(fileContent);
  }

  findAccountByEmail(email) {
    const accounts = this.listAccounts();
    return accounts.find(account => account.email === email);
  }

  findAccountByUsername(username) {
    const accounts = this.listAccounts();
    return accounts.find(account => account.username === username);
  }
}

