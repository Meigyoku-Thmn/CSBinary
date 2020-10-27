/* eslint-disable no-undef */
if (process.env.SKIP_BUILD) {
  console.log('Skip normal build process.');
  process.exit(0);
}
else
  process.exit(1);