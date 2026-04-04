exports.up = (pgm) => {
    pgm.addColumns('users', {
        display_name: {
            type: 'varchar(100)',
            notNull: false
        },
        bio: {
            type: 'text',
            notNull: false
        },
        status: {
            type: 'varchar(100)',
            notNull: false,
            default: 'Hey there! I am using ConnectHub'
        }
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('users', ['display_name', 'bio', 'status']);
};
