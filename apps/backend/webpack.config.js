const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  // Configure ts-loader to skip type checking (transpile only)
  const rules = options.module?.rules?.map((rule) => {
    if (rule.loader === 'ts-loader' || (rule.use && rule.use.loader === 'ts-loader')) {
      return {
        ...rule,
        options: { ...(rule.options || {}), transpileOnly: true },
      };
    }
    return rule;
  });

  return {
    ...options,
    module: {
      ...options.module,
      rules: rules || options.module?.rules,
    },
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
  };
};
