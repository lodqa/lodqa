require 'term/finder'

describe Term::Finder do
  describe "#initialize" do
    context "when a URL is given" do
      it "should produce a enju accessor" do
        d = Term::Finder.new('hoge')
        expect(d.dictionary.url).to eq('hoge')
      end
    end

    context "when a URL is not given" do
      it "should raise an ArgumentError" do
        expect{Term::Finder.new}.to raise_error(ArgumentError)
      end
    end

    context "when an empty URL is not given" do
      it "should raise an ArgumentError" do
        expect{Term::Finder.new("")}.to raise_error(ArgumentError)
      end
    end
  end

  describe "#find" do
    before do
      @d = Term::Finder.new('http://pubdictionaries.org/find_ids.json?dictionary=DrugBank-QALD,SIDER-QALD,Diseasome-QALD&threshold=0.6')
      @terms = ["genes", "alzheimer's disease"]
    end

    context "when a set of term is given" do
      it "should return a dictionary for the terms" do
        dictionary = @d.find(@terms)
        expect(dictionary[:genes]).to be_kind_of(Array)
      end
    end

    context "when nothing is given" do
      it "should return nil" do
        expect(@d.find(nil)).to be_nil
      end
    end

    context "when an empty array is given" do
      it "should return an empty array" do
        expect(@d.find([])).to be_empty
      end
    end
  end
end
