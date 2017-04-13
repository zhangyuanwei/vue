/* @flow */

import { isUnaryTag, canBeLeftOpenTag } from 'web/compiler/util'
import { genStaticKeys } from 'shared/util'
import { createCompiler } from './compiler/index'

import modules from 'web/compiler/modules/index'
import directives from 'web/compiler/directives/index'

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from 'web/util/index'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag,
  isUnaryTag,
  mustUseProp,
  canBeLeftOpenTag,
  isReservedTag,
  getTagNamespace,
  staticKeys: genStaticKeys(modules)
}

const { compile, compileToFunctions } = createCompiler(baseOptions)
export { compile, compileToFunctions }
