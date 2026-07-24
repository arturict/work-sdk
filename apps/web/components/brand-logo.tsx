type Brand = "github" | "gitlab" | "linear" | "jira" | "azure-devops";

const logos = {
  github: {
    light: "/brands/github-light.svg",
    dark: "/brands/github-dark.svg",
  },
  gitlab: { light: "/brands/gitlab.svg" },
  linear: { light: "/brands/linear.svg" },
  jira: { light: "/brands/atlassian.svg" },
  "azure-devops": { light: "/brands/azure.svg" },
} as const;

type BrandLogoProps = {
  brand: Brand;
  className?: string;
  inverse?: boolean;
};

export function BrandLogo({ brand, className = "brand-logo", inverse = false }: BrandLogoProps) {
  const logo = logos[brand];
  const image = <img alt="" className={className} height="20" src={inverse && "dark" in logo ? logo.dark : logo.light} width="20" />;

  if (inverse || !("dark" in logo)) return image;

  return (
    <picture aria-hidden="true">
      <source media="(prefers-color-scheme: dark)" srcSet={logo.dark} />
      {image}
    </picture>
  );
}
