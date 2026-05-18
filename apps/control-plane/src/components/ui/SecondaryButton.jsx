import Button from './Button';

export default function SecondaryButton({ children, className = '', ...props }) {
  return (
    <Button variant="secondary" className={className} {...props}>
      {children}
    </Button>
  );
}
