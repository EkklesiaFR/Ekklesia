import * as React from 'react';

type Props = React.SVGProps<SVGSVGElement> & { title?: string };

export function EkklesiaAssemblyLogo({ title, className, ...props }: Props) {
  const titleId = React.useId();

  return (
    <svg
      viewBox="0 0 116 151"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      className={className}
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}

      <g clipPath="url(#clip0)">
        <path
          d="M116 0V45.614L85.8083 75.2464L116 105.569V150.998H105.715L37.8704 83.4686L10.1919 109.826V137.49L40.1183 108.071L47.0532 115.402L12.1375 150.998H0V105.754L30.3864 75.7759L0.0370951 45.3918L0.0111285 1.37562L0.0445141 0H9.73004L33.6341 23.5078L57.3508 0.559136L82.1452 23.4819L106.272 0H116ZM58.0927 14.6227L40.9548 31.7356L57.5363 48.119L74.498 31.1802L58.0927 14.6208V14.6227ZM105.467 15.1781L104.688 16.0002L65.4042 55.423L78.1296 68.2701L105.341 41.2631L105.432 17.298L105.467 15.1781ZM10.1919 15.7299V40.6188L37.5235 67.7202C39.1427 66.3279 40.7916 64.9375 42.3459 63.4767C43.392 62.4936 50.2137 55.7821 50.2193 55.049L10.1919 15.7299ZM58.0927 62.5492L44.8461 75.7759L57.7459 88.623L70.9555 75.5648L58.0909 62.5473L58.0927 62.5492ZM105.437 109.733L104.877 109.468L78.2558 83.4816L65.981 96.1066L105.437 135.826V109.733Z"
          fill="currentColor"
        />
      </g>

      <defs>
        <clipPath id="clip0">
          <rect width="116" height="151" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
  );
}