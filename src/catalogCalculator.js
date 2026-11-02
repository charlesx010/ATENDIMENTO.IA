// Closed declarative interpreter. Catalog strings are never executed as JavaScript.
export function evaluateCatalogAst(node, weight, variables = {}, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) throw Error('Fórmula inválida.');
  const run = child => evaluateCatalogAst(child, weight, variables, depth + 1);
  let value;
  if (node.type === 'number') value = node.value;
  else if (node.type === 'weight') value = weight;
  else if (node.type === 'variable') {
    if (!['DOSE_MCG_KG_MIN', 'SCQ_PERCENTUAL'].includes(node.name)) throw Error('Entrada não permitida.');
    value = variables[node.name];
  } else if (node.type === 'if') value = run(node.condition) ? run(node.yes) : run(node.no);
  else if (node.type === 'op') {
    const left = run(node.left), right = run(node.right);
    switch (node.operator) {
      case '+': value = left + right; break;
      case '-': value = left - right; break;
      case '*': value = left * right; break;
      case '/': value = left / right; break;
      case '<': value = Number(left < right); break;
      case '<=': value = Number(left <= right); break;
      case '>': value = Number(left > right); break;
      case '>=': value = Number(left >= right); break;
      case '||': value = left || right; break;
      default: throw Error('Operação não permitida.');
    }
  } else if (node.type === 'call') {
    const args = (node.arguments || []).map(run);
    if (!args.length) throw Error('Fórmula incompleta.');
    switch (node.name) {
      case 'Math.min': value = Math.min(...args); break;
      case 'Math.max': value = Math.max(...args); break;
      case 'Math.round': if (args.length !== 1) throw Error('Fórmula inválida.'); value = Math.round(args[0]); break;
      default: throw Error('Função não permitida.');
    }
  } else throw Error('Operação não permitida.');
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('Resultado inválido.');
  return value;
}

export function catalogAstOutput(definition, inputs) {
  const ast = definition.ast;
  const value = evaluateCatalogAst(ast, inputs.weight, inputs);
  if (value < 0) throw Error('Resultado inválido.');
  const cap = ast.type === 'call' && ast.name === 'Math.min'
    ? ast.arguments.find(child => child.type === 'number')?.value : undefined;
  const expression = cap === undefined ? ast : ast.arguments.find(child => child.type !== 'number');
  const raw = expression ? evaluateCatalogAst(expression, inputs.weight, inputs) : value;
  return {...definition, value, raw, maximum: cap, limited: cap !== undefined && raw > cap};
}


