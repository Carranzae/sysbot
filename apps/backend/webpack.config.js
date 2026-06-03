const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  // Configurar ts-loader para omitir la verificación de tipos durante la compilación
  if (options.module && options.module.rules) {
    options.module.rules.forEach((rule) => {
      if (rule.use) {
        const uses = Array.isArray(rule.use) ? rule.use : [rule.use];
        uses.forEach((use) => {
          if (typeof use === 'string' && use.includes('ts-loader')) {
            rule.use = {
              loader: 'ts-loader',
              options: { transpileOnly: true }
            };
          } else if (typeof use === 'object' && use.loader && use.loader.includes('ts-loader')) {
            use.options = {
              ...use.options,
              transpileOnly: true
            };
          }
        });
      } else if (rule.loader && rule.loader.includes('ts-loader')) {
        rule.options = {
          ...rule.options,
          transpileOnly: true
        };
      }
    });
  }

  // Eliminar ForkTsCheckerWebpackPlugin para evitar el consumo excesivo de memoria y verificación de tipos paralela
  if (options.plugins) {
    options.plugins = options.plugins.filter(
      (plugin) => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
    );
  }

  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100', /^@syst\//],
      }),
    ],
  };
};
