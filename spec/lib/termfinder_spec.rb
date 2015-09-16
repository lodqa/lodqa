describe Lodqa::TermFinder do
  describe "#initialize" do
    context "when a URL is given" do 
      before do
        @dictionaryURL = "http://pubdictionaries.org:80/dictionaries/id_mapping?dictionaries=%5B%22qald-drugbank%22%2C%22qald-diseasome%22%2C%22qald-sider%22%5D&output_format=simple&threshold=0.5&top_n=0"
      end

      it "should produce a enju accessor" do
        d = Lodqa::TermFinder.new(@dictionaryURL)
        expect(d.dictionary.url).to eq(@dictionaryURL)
      end
    end

    context "when a URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::TermFinder.new}.to raise_error(ArgumentError)
      end
    end

    context "when an empty URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::TermFinder.new("")}.to raise_error(ArgumentError)
      end
    end
  end

  describe "#find" do
    before do
      dictionaryURL = "http://pubdictionaries.org:80/dictionaries/id_mapping?dictionaries=%5B%22qald-drugbank%22%2C%22qald-diseasome%22%2C%22qald-sider%22%5D&output_format=simple&threshold=0.5&top_n=0"
      @d = Lodqa::TermFinder.new(dictionaryURL)
      @terms = ["genes", "alzheimer's disease"]
    end

    context "when a set of term is given" do
      it "should return a dictionary for the terms" do
        dictionary = @d.find(@terms)
        expect(dictionary[@terms[0]]).to be_kind_of(Array)
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
