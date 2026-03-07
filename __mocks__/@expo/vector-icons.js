const React = require('react');
const { Text } = require('react-native');

const createMockIcon = () => {
  const Icon = ({ name, size, color, testID }) =>
    React.createElement(Text, { testID }, name ?? '');
  Icon.glyphMap = new Proxy({}, { get: () => '' });
  return Icon;
};

const Ionicons = createMockIcon();

module.exports = { Ionicons };
