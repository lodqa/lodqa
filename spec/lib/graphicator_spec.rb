describe Lodqa::Graphicator do
  describe "#initialize" do
    context "when a URL is given" do 
      before do
        @enjuURL = "http://bionlp.dbcls.jp/enju"
      end

      it "should produce a enju accessor" do
        g = Lodqa::Graphicator.new(@enjuURL)
        expect(g.parser.enju.url).to eq(@enjuURL)
      end
    end

    context "when a URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::Graphicator.new}.to raise_error(ArgumentError)
      end
    end

    context "when an empty URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::Graphicator.new("")}.to raise_error(ArgumentError)
      end
    end
  end

  describe "#parse" do
    before do
      @enjuURL = "http://bionlp.dbcls.jp/enju"
      @g = Lodqa::Graphicator.new(@enjuURL)
      @query = "what genes are associated with alzheimer disease?"
    end

    context "when a sentence is given" do
      it "should produce its parse" do
        parse = @g.parse(@query)
        expect(parse[:root]).to eq(3)
      end
    end
  end
end
