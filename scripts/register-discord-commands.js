const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'task',
    description: 'Create a quick task',
    options: [
      {
        name: 'description',
        type: 3, // STRING
        description: 'Task description',
        required: true
      },
      {
        name: 'due',
        type: 3, // STRING
        description: 'Due date (e.g., tomorrow, next week)',
        required: false
      },
      {
        name: 'priority',
        type: 3, // STRING
        description: 'Priority level',
        required: false,
        choices: [
          { name: 'High', value: 'high' },
          { name: 'Medium', value: 'medium' },
          { name: 'Low', value: 'low' }
        ]
      }
    ]
  },
  {
    name: 'tasks',
    description: 'View your pending tasks'
  },
  {
    name: 'digest',
    description: 'Get your daily task digest (only you can see it)'
  },
  {
    name: 'everling',
    description: 'Everling bot commands',
    options: [
      {
        name: 'help',
        type: 1, // SUB_COMMAND
        description: 'Show help information'
      },
      {
        name: 'context',
        type: 1, // SUB_COMMAND
        description: 'Extract tasks from recent conversation'
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    // Register commands globally
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('Successfully registered the following commands:');
    commands.forEach(cmd => {
      console.log(`  /${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\n✅ Commands are now available in all servers where the bot is present!');
    console.log('Note: It may take up to an hour for commands to appear in all servers.');
    
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();
