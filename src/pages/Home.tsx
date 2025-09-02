import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileCheck, Users, Building, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home = () => {
  const features = [
    {
      icon: Shield,
      title: 'Blockchain Verification',
      description: 'Every certificate is registered on the Ethereum blockchain for immutable proof of authenticity.'
    },
    {
      icon: FileCheck,
      title: 'Instant Validation',
      description: 'Verify certificate authenticity in seconds with cryptographic hash verification.'
    },
    {
      icon: Users,
      title: 'Trusted by Institutions',
      description: 'Educational institutions worldwide trust VeriDoc for certificate management.'
    },
    {
      icon: Building,
      title: 'Enterprise Ready',
      description: 'Built for scale with robust infrastructure and comprehensive audit trails.'
    }
  ];

  const stats = [
    { value: '10,000+', label: 'Certificates Issued' },
    { value: '500+', label: 'Institutions' },
    { value: '99.9%', label: 'Verification Accuracy' },
    { value: '24/7', label: 'Availability' }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-background/80 backdrop-blur border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">VeriDoc</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/verify">
                <Button variant="ghost">Verify Certificate</Button>
              </Link>
              <Link to="/issue">
                <Button>Issue Certificate</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-background via-secondary/20 to-primary/5 py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Secure Certificate
              <span className="text-primary block">Authenticity Validation</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Protect academic credentials with blockchain technology. Issue, verify, and validate certificates with cryptographic security and permanent immutability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link to="/issue">
                <Button size="lg" className="min-w-[200px] h-14 text-lg">
                  <FileCheck className="w-5 h-5 mr-2" />
                  Issue Certificate
                </Button>
              </Link>
              <Link to="/verify">
                <Button variant="outline" size="lg" className="min-w-[200px] h-14 text-lg">
                  <Shield className="w-5 h-5 mr-2" />
                  Verify Certificate
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-primary-foreground/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gradient-to-b from-background to-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Why Choose VeriDoc?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built on cutting-edge blockchain technology to ensure the highest standards of certificate security and verification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 bg-card/50 backdrop-blur shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple, secure, and transparent certificate management
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Issue Process */}
            <Card className="border-0 bg-card/50 backdrop-blur shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <FileCheck className="w-8 h-8 text-primary" />
                  For Institutions
                </CardTitle>
                <CardDescription className="text-base">
                  Issue certificates with blockchain verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Connect MetaMask Wallet</p>
                    <p className="text-sm text-muted-foreground">Securely connect your institutional wallet</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Upload Certificate & Fill Details</p>
                    <p className="text-sm text-muted-foreground">Add PDF and student information</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Blockchain Registration</p>
                    <p className="text-sm text-muted-foreground">Certificate hash stored permanently on-chain</p>
                  </div>
                </div>
                <Link to="/issue" className="block pt-4">
                  <Button className="w-full">
                    Start Issuing <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Verify Process */}
            <Card className="border-0 bg-card/50 backdrop-blur shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Shield className="w-8 h-8 text-primary" />
                  For Employers
                </CardTitle>
                <CardDescription className="text-base">
                  Verify certificate authenticity instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Connect MetaMask Wallet</p>
                    <p className="text-sm text-muted-foreground">Connect for verification logging</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Upload Certificate PDF</p>
                    <p className="text-sm text-muted-foreground">System generates SHA256 hash automatically</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Instant Verification</p>
                    <p className="text-sm text-muted-foreground">Cross-check with blockchain and database</p>
                  </div>
                </div>
                <Link to="/verify" className="block pt-4">
                  <Button variant="outline" className="w-full">
                    Start Verifying <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Secure Your Certificates?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join thousands of institutions already using VeriDoc to protect their academic credentials with blockchain technology.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/issue">
              <Button size="lg" variant="secondary" className="min-w-[200px]">
                Issue Certificate
              </Button>
            </Link>
            <Link to="/verify">
              <Button size="lg" variant="outline" className="min-w-[200px] border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Verify Certificate
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-6 h-6" />
            <span className="text-xl font-bold">VeriDoc</span>
          </div>
          <p className="text-background/80 mb-4">
            Blockchain-powered certificate authenticity validation
          </p>
          <p className="text-sm text-background/60">
            Built with React, TypeScript, Supabase, and Ethereum • Secured by MetaMask
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;