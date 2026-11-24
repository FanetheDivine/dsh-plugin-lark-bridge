/** CSS 的类型声明：CSS Modules 与全局样式文件。 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

/** 全局样式文件只做副作用导入。 */
declare module '*.css';
