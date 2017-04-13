/* @flow */

let vuescript = require("./vuescript");

export function transformExpressionNoFilter(exp: string) {
    let ast = vuescript.parse(exp, {
        startRule: "VueExpressionNoFilter"
    });
    let result = genCode(ast);
    return result.code;
}

export function transformExpression(exp: string): string {
    let ast = vuescript.parse(exp, {
        startRule: "VueExpression"
    });
    let result = genCode(ast);
    return result.code;
}

export function varExport(data: any) {
    switch (getType(data)) {
        case Boolean:
            return data ? "true" : "false";
        case Number:
            return String(data);
        case String:
            return JSON.stringify(data);
        case Array:
            return `array(${data.map(varExport).join(",")})`;
        case Object:
            return `array(${Object.keys(data).map(function(key){
                return `${varExport(key)}=>${varExport(data[key])}`;
            }).join(",")})`;
        default:
            throw new Error("Unknow data type");
    }
    // return transformExpressionNoFilter(JSON.stringify(data));
}

function genCode(node) {
    let left;
    let right;
    let value;
    switch (node.type) {
        case "VueExpression":
            return node.filters.reduce(function(pre, filter) {
                var args = filter["arguments"];
                args = args.map(function(arg) {
                    return genCode(arg).code;
                });
                return ret(`$c->${encodePhpIdentifier(filter.name)}(${pre.code}${(args.length)?(","+args.join(",")):""})`);
            }, genCode(node.expression));
        case "Identifier":
            return ret(`$ctx->_d[${genPropertyKey(node).code}]`);
        case "MemberExpression":
            // var obj = genCode(node.obj);
            // var property = genCode(node.property);
            // if (property.isStatic) {
            // }
            //console.log(node);
            //let property = node.property;
            //if(property.type=)
            var property;
            var obj = genCode(node.object);
            var len;

            if (!node.computed) {
                property = genPropertyKey(node.property);
            } else {
                property = genCode(node.property);
            }
            if (property.isStatic && property.value === "length") {
                if (obj.type === String) {
                    if (obj.isStatic) {
                        len = obj.value.length;
                        return ret(JSON.stringify(len), Number, len);
                    } else {
                        // FIXME 多字节考虑
                        return ret(`strlen(${obj.code})`, Number);
                    }
                    // XXX：现在没有能预判为 Array 的情况
                    // } else if (obj.type === Array) {
                } else {
                    return ret(`$c->_len(${obj.code})`);
                }
            }
            // FIXME 这里也有可能会踩到坑
            return ret(`${obj.code}[${property.code}]`);
        case "Literal":
            return ret(`(${JSON.stringify(node.value)})`, getType(node.value), node.value);
        case "BinaryExpression":
             left = genCode(node.left);
             right = genCode(node.right);
            if (left.isStatic && right.isStatic) {
                switch (node.operator) {
                    case "+":
                        value = left.value + right.value;
                        break;
                    case "-":
                        value = left.value - right.value;
                        break;
                    case "*":
                        value = left.value * right.value;
                        break;
                    case "/":
                        value = left.value / right.value;
                        break;
                    case "%":
                        value = left.value % right.value;
                        break;
                    case ">":
                        value = left.value > right.value;
                        break;
                    case ">=":
                        value = left.value >= right.value;
                        break;
                    case "<":
                        value = left.value < right.value;
                        break;
                    case "<=":
                        value = left.value <= right.value;
                        break;
                    case "==":
                        value = left.value == right.value;
                        break;
                    case "!=":
                        value = left.value != right.value;
                        break;
                    case "===":
                        value = left.value === right.value;
                        break;
                    case "!==":
                        value = left.value !== right.value;
                        break;
                    default:
                        throw new Error("Unknow binary operator \"" + node.operator + "\"");
                }
                return ret(JSON.stringify(value), getType(value), value);
            }
            if (node.operator === "+") {
                if (left.type === String || right.type === String) {
                    left = left.isStatic ? JSON.stringify(left.value) : left.code;
                    right = right.isStatic ? JSON.stringify(right.value) : right.code;
                    return ret(`(${left} . ${right})`, String);
                } else {
                    return ret(`$c->_a(${left.code}, ${right.code})`);
                }
            }
            return ret(`(${left.code}${node.operator}${right.code})`);
        case "LogicalExpression":
            left = genCode(node.left);
             right = genCode(node.right);
            if (left.isStatic && right.isStatic) {
                switch (node.operator) {
                    case "&&":
                        value = left.value && right.value;
                        break;
                    case "||":
                        value = left.value || right.value;
                        break;
                    default:
                        throw new Error("Unknow logical operator \"" + node.operator + "\"");
                }
                return ret(JSON.stringify(value), getType(value), value);
            }
            return ret(`(${left.code}${node.operator}${right.code})`);
        case "ObjectExpression":
            return ret(`array(${node.properties.map(function(prop){
                    return genCode(prop).code;
            }).join(",")})`);
        case "Property":
            return ret(`${genPropertyKey(node.key).code} => ${genCode(node.value).code}`);
        case "ArrayExpression":
            return ret(`array(${node.elements.map(function(element){
                    return genCode(element).code;
            }).join(",")})`);
        case "ConditionalExpression":
            var test = genCode(node.test);
            var consequent = genCode(node.consequent);
            var alternate = genCode(node.alternate);
            if (test.isStatic) {
                return test.value ? consequent : alternate;
            } else {
                return ret(`(${test.code}?${consequent.code}:${alternate.code})`);
            }
        default:
            console.log(JSON.stringify(node, null, 2));
            throw new Error("Unknow type \"" + node.type + "\"");
    }
}

function genPropertyKey(node) {
    switch (node.type) {
        case "Identifier":
            return ret(JSON.stringify(node.name), String, node.name);
        case "Literal":
            return ret(JSON.stringify(String(node.value)), String, String(node.value));
        default:
            throw new Error("Unknow property key type \"" + node.type + "\"");
    }
}

function getType(obj) {
    var typeStr = Object.prototype.toString.call(obj);
    typeStr = typeStr.substring(8, typeStr.length - 1).toLowerCase();
    switch (typeStr) {
        case "boolean":
            return Boolean;
        case "number":
            return Number;
        case "string":
            return String;
        case "array":
            return Array;
        case "object":
            return Object;
    }
}

function encodePhpIdentifier(id) {
    return id
        .replace(/_/g, "__")
        .replace(/\$/g, "_0");
}

function ret(code, type, value) {
    var isStatic = false;
    if (arguments.length > 2) {
        isStatic = true;
    }
    return {
        code: code,
        type: type,
        value: value,
        isStatic: isStatic
    }
}
