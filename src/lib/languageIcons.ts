import * as DevIcons from 'devicons-react';

interface LanguageConfig {
  icon: keyof typeof DevIcons;
  color: string;
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  'JavaScript': { icon: 'JavascriptOriginal', color: '#f1e05a' },
  'TypeScript': { icon: 'TypescriptOriginal', color: '#3178c6' },
  'Python': { icon: 'PythonOriginal', color: '#3572A5' },
  'Rust': { icon: 'RustOriginal', color: '#dea584' },
  'Go': { icon: 'GoOriginal', color: '#00ADD8' },
  'Java': { icon: 'JavaOriginal', color: '#b07219' },
  'C++': { icon: 'CplusplusOriginal', color: '#f34b7d' },
  'C': { icon: 'COriginal', color: '#555555' },
  'C#': { icon: 'CsharpOriginal', color: '#178600' },
  'PHP': { icon: 'PhpOriginal', color: '#4F5D95' },
  'Ruby': { icon: 'RubyOriginal', color: '#701516' },
  'Swift': { icon: 'SwiftOriginal', color: '#FA7343' },
  'Kotlin': { icon: 'KotlinOriginal', color: '#A97BFF' },
  'Dart': { icon: 'DartOriginal', color: '#00B4AB' },
  'Vue': { icon: 'VuejsOriginal', color: '#41b883' },
  'HTML': { icon: 'Html5Original', color: '#e34c26' },
  'CSS': { icon: 'Css3Original', color: '#563d7c' },
  'SCSS': { icon: 'SassOriginal', color: '#c6538c' },
  'Shell': { icon: 'BashOriginal', color: '#89e051' },
  'YAML': { icon: 'YamlPlain', color: '#cb171e' },
  'JSON': { icon: 'JsonPlain', color: '#292929' },
  'Markdown': { icon: 'MarkdownOriginal', color: '#083fa1' },
  'React': { icon: 'ReactOriginal', color: '#61dafb' },
  'Node.js': { icon: 'NodejsOriginal', color: '#339933' },
  'Docker': { icon: 'DockerOriginal', color: '#2496ed' },
  'GraphQL': { icon: 'GraphqlPlain', color: '#e10098' },
  'MongoDB': { icon: 'MongodbOriginal', color: '#47A248' },
  'PostgreSQL': { icon: 'PostgresqlOriginal', color: '#336791' },
  'MySQL': { icon: 'MysqlOriginal', color: '#4479A1' },
  'Redis': { icon: 'RedisOriginal', color: '#DC382D' },
  'Git': { icon: 'GitOriginal', color: '#F05032' },
  'Vim': { icon: 'VimOriginal', color: '#019733' },
  'Linux': { icon: 'LinuxOriginal', color: '#FCC624' },
  'Windows': { icon: 'Windows8Original', color: '#0078D6' },
  'Apple': { icon: 'AppleOriginal', color: '#000000' },
  'Android': { icon: 'AndroidOriginal', color: '#3DDC84' },
  'Flutter': { icon: 'FlutterOriginal', color: '#02569B' },
  'Tailwind CSS': { icon: 'TailwindcssOriginal', color: '#06b6d4' },
  'Next.js': { icon: 'NextjsOriginal', color: '#000000' },
  'Svelte': { icon: 'SvelteOriginal', color: '#ff3e00' },
  'Angular': { icon: 'AngularOriginal', color: '#DD0031' },
  'Django': { icon: 'DjangoPlain', color: '#092E20' },
  'Flask': { icon: 'FlaskOriginal', color: '#000000' },
  'Laravel': { icon: 'LaravelOriginal', color: '#FF2D20' },
  'Spring': { icon: 'SpringOriginal', color: '#6DB33F' },
};

export const getLanguageIcon = (language: string): React.ComponentType<any> | null => {
  const config = LANGUAGE_CONFIG[language];
  if (!config) return null;
  
  const IconComponent = DevIcons[config.icon];
  return IconComponent || null;
};

export const getLanguageColor = (language: string): string => {
  return LANGUAGE_CONFIG[language]?.color || '#6c757d';
};