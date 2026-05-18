import Button from './Button';

export default function PrimaryButton({ children, className = '', ...props }) {
  return (
    <Button variant="primary" className={className} {...props}>
      {children}
    </Button>
  );
}
