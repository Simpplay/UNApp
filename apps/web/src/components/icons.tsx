import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="6" />
    <path d="M13.5 13.5L17 17" />
  </Icon>
);

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12.5 4.5L7 10l5.5 5.5" />
  </Icon>
);

export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7.5 4.5L13 10l-5.5 5.5" />
  </Icon>
);

export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 8l5 5 5-5" />
  </Icon>
);

export const GearIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 2v2M10 16v2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M2 10h2M16 10h2M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
    <circle cx="10" cy="10" r="3.2" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Icon>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </Icon>
);

export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 2l1.6 4.9L16.5 8.5l-4.4 2.3L10 16l-2.1-5.2-4.4-2.3 4.9-1.6L10 2z" strokeLinejoin="round" />
  </Icon>
);

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 3v10M6 9l4 4 4-4M4 16h12" />
  </Icon>
);

export const UploadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 13V3M6 7l4-4 4 4M4 16h12" />
  </Icon>
);

export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10a6 6 0 0110.2-4.3M16 10a6 6 0 01-10.2 4.3" />
    <path d="M14.2 3.8v2.9h-2.9M5.8 16.2v-2.9h2.9" />
  </Icon>
);

export const WifiIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3.5 8.2a9.5 9.5 0 0113 0M6 11a5.5 5.5 0 018 0" />
    <path d="M8.5 13.8a2 2 0 013 0" strokeLinecap="round" />
    <circle cx="10" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);
