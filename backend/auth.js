const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

const GoogleStrategy = require('passport-google-oauth20').Strategy;

// ... serialize/deserialize ...

passport.use(new LocalStrategy(
  async function (username, password, done) {
    try {
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.passwordHash) {
        return done(null, false, { message: 'Use Google Login' });
      }

      const isValid = await user.verifyPassword(password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
    async function (accessToken, refreshToken, profile, cb) {
      try {
        let user = await User.findOne({ googleId: profile.id });
        const photoUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

        if (!user) {
          user = new User({
            googleId: profile.id,
            displayName: profile.displayName,
            profilePicture: photoUrl
          });
          await user.save();
        } else {
          // Update profile picture and name if they changed
          user.profilePicture = photoUrl;
          user.displayName = profile.displayName;
          await user.save();
        }
        return cb(null, user);
      } catch (err) {
        return cb(err, null);
      }
    }));
}

module.exports = passport;
